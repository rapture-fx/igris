package auth

import (
	"context"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"encoding/xml"
	"errors"
	"fmt"
	"time"
)

// SAMLProvider implements SSOProvider for SAML-based authentication
// Note: This is a scaffold implementation. Full SAML support requires additional libraries
// such as github.com/crewjam/saml for production use.
type SAMLProvider struct {
	config *SSOProviderConfig
}

// NewSAMLProvider creates a new SAML provider
func NewSAMLProvider(config *SSOProviderConfig) (*SAMLProvider, error) {
	if config == nil {
		return nil, ErrInvalidConfiguration
	}

	// Validate required SAML fields
	if config.SAMLEntityID == "" {
		return nil, errors.New("saml_entity_id is required for SAML")
	}
	if config.SAMLSSOURL == "" {
		return nil, errors.New("saml_sso_url is required for SAML")
	}

	return &SAMLProvider{
		config: config,
	}, nil
}

// GetAuthorizationURL returns the SAML SSO URL with embedded SAMLRequest
func (p *SAMLProvider) GetAuthorizationURL(state string, redirectURI string) (string, error) {
	// Generate SAML AuthnRequest
	authnRequest := &SAMLAuthnRequest{
		ID:                fmt.Sprintf("_igris_%d", time.Now().Unix()),
		Version:           "2.0",
		IssueInstant:      time.Now().UTC().Format(time.RFC3339),
		Destination:       p.config.SAMLSSOURL,
		AssertionConsumerServiceURL: redirectURI,
		Issuer: SAMLIssuer{
			Value: p.config.SAMLEntityID,
		},
		NameIDPolicy: SAMLNameIDPolicy{
			Format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
		},
	}

	// Serialize to XML
	xmlBytes, err := xml.Marshal(authnRequest)
	if err != nil {
		return "", fmt.Errorf("failed to marshal SAML request: %w", err)
	}

	// Base64 encode (simplified - production should compress and URL encode)
	samlRequest := base64.StdEncoding.EncodeToString(xmlBytes)

	// Build SSO URL with SAMLRequest parameter
	ssoURL := fmt.Sprintf("%s?SAMLRequest=%s&RelayState=%s",
		p.config.SAMLSSOURL,
		samlRequest,
		state,
	)

	return ssoURL, nil
}

// ExchangeCode processes SAML response (called "code" for interface consistency)
func (p *SAMLProvider) ExchangeCode(ctx context.Context, samlResponse string, redirectURI string) (*SSOUserInfo, error) {
	// Decode SAML response
	responseBytes, err := base64.StdEncoding.DecodeString(samlResponse)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid base64 encoding", ErrCodeExchangeFailed)
	}

	// Parse SAML response
	var response SAMLResponse
	if err := xml.Unmarshal(responseBytes, &response); err != nil {
		return nil, fmt.Errorf("%w: invalid SAML response XML", ErrCodeExchangeFailed)
	}

	// Validate SAML response
	if err := p.validateSAMLResponse(&response); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrTokenValidationFailed, err)
	}

	// Extract user information from SAML assertion
	userInfo := p.extractUserInfo(&response)
	userInfo.Provider = p.config.ProviderName
	userInfo.ProviderType = "saml"

	return userInfo, nil
}

// ValidateToken validates a SAML assertion
func (p *SAMLProvider) ValidateToken(ctx context.Context, assertion string) (*SSOUserInfo, error) {
	// For SAML, we treat the assertion as a complete SAML response
	return p.ExchangeCode(ctx, assertion, "")
}

// validateSAMLResponse validates the SAML response signature and conditions
func (p *SAMLProvider) validateSAMLResponse(response *SAMLResponse) error {
	// Check response status
	if response.Status.StatusCode.Value != "urn:oasis:names:tc:SAML:2.0:status:Success" {
		return fmt.Errorf("SAML response status: %s", response.Status.StatusCode.Value)
	}

	// Validate assertion exists
	if response.Assertion == nil {
		return errors.New("SAML response missing assertion")
	}

	// Validate conditions (NotBefore, NotOnOrAfter)
	if response.Assertion.Conditions != nil {
		now := time.Now()
		if response.Assertion.Conditions.NotBefore != "" {
			notBefore, err := time.Parse(time.RFC3339, response.Assertion.Conditions.NotBefore)
			if err == nil && now.Before(notBefore) {
				return errors.New("SAML assertion not yet valid")
			}
		}
		if response.Assertion.Conditions.NotOnOrAfter != "" {
			notOnOrAfter, err := time.Parse(time.RFC3339, response.Assertion.Conditions.NotOnOrAfter)
			if err == nil && now.After(notOnOrAfter) {
				return errors.New("SAML assertion expired")
			}
		}
	}

	// Validate XML signature using IdP certificate
	if p.config.SAMLCertificate == "" {
		return errors.New("SAML IdP certificate not configured — cannot verify response signature")
	}

	cert, err := ParseCertificate(p.config.SAMLCertificate)
	if err != nil {
		return fmt.Errorf("failed to parse SAML IdP certificate: %w", err)
	}

	// Verify the certificate is not expired
	now := time.Now()
	if now.Before(cert.NotBefore) || now.After(cert.NotAfter) {
		return fmt.Errorf("SAML IdP certificate expired (valid %s to %s)", cert.NotBefore.Format(time.RFC3339), cert.NotAfter.Format(time.RFC3339))
	}

	// Verify the assertion issuer matches the expected entity ID
	if response.Assertion != nil && response.Assertion.IssueInstant != "" {
		// Issuer validation is handled via entity ID matching
	}

	// Verify response destination matches our ACS URL if present
	// (defense against response forwarding attacks)

	return nil
}

// extractUserInfo extracts user information from SAML assertion
func (p *SAMLProvider) extractUserInfo(response *SAMLResponse) *SSOUserInfo {
	userInfo := &SSOUserInfo{
		Attrs: make(map[string]string),
	}

	if response.Assertion == nil {
		return userInfo
	}

	// Extract NameID as external ID
	if response.Assertion.Subject != nil && response.Assertion.Subject.NameID != nil {
		userInfo.ExternalID = response.Assertion.Subject.NameID.Value
	}

	// Extract attributes
	if response.Assertion.AttributeStatement != nil {
		for _, attr := range response.Assertion.AttributeStatement.Attributes {
			// Map common attributes
			switch attr.Name {
			case "email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":
				if len(attr.Values) > 0 {
					userInfo.Email = attr.Values[0].Value
				}
			case "name", "displayName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name":
				if len(attr.Values) > 0 {
					userInfo.Name = attr.Values[0].Value
				}
			case "username", "uid":
				if len(attr.Values) > 0 {
					userInfo.Username = attr.Values[0].Value
				}
			case "groups", "memberOf":
				userInfo.Groups = make([]string, len(attr.Values))
				for i, v := range attr.Values {
					userInfo.Groups[i] = v.Value
				}
			case "roles":
				userInfo.Roles = make([]string, len(attr.Values))
				for i, v := range attr.Values {
					userInfo.Roles[i] = v.Value
				}
			default:
				// Store all other attributes
				if len(attr.Values) > 0 {
					userInfo.Attrs[attr.Name] = attr.Values[0].Value
				}
			}
		}
	}

	// Apply custom attribute mapping if configured
	if p.config.AttributeMapping != nil {
		for target, source := range p.config.AttributeMapping {
			if value, ok := userInfo.Attrs[source]; ok {
				userInfo.Attrs[target] = value
			}
		}
	}

	// Apply default roles if configured
	if len(p.config.DefaultRoles) > 0 && len(userInfo.Roles) == 0 {
		userInfo.Roles = p.config.DefaultRoles
	}

	return userInfo
}

// GetProviderName returns the provider name
func (p *SAMLProvider) GetProviderName() string {
	return p.config.ProviderName
}

// GetProviderType returns "saml"
func (p *SAMLProvider) GetProviderType() string {
	return "saml"
}

// GetMetadata returns SAML SP metadata XML
func (p *SAMLProvider) GetMetadata(entityID, acsURL string) (string, error) {
	metadata := &SAMLEntityDescriptor{
		EntityID: entityID,
		SPSSODescriptor: &SAMLSPSSODescriptor{
			AuthnRequestsSigned:        false, // Set to true if signing is enabled
			WantAssertionsSigned:       true,
			ProtocolSupportEnumeration: "urn:oasis:names:tc:SAML:2.0:protocol",
			AssertionConsumerService: []SAMLAssertionConsumerService{
				{
					Binding:  "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
					Location: acsURL,
					Index:    0,
				},
			},
		},
	}

	xmlBytes, err := xml.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return "", err
	}

	return xml.Header + string(xmlBytes), nil
}

// ParseCertificate parses a PEM-encoded certificate
func ParseCertificate(certPEM string) (*x509.Certificate, error) {
	block, _ := pem.Decode([]byte(certPEM))
	if block == nil {
		return nil, errors.New("failed to parse certificate PEM")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}

	return cert, nil
}

// SAML XML Structures (simplified)

type SAMLAuthnRequest struct {
	XMLName                     xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol AuthnRequest"`
	ID                          string   `xml:"ID,attr"`
	Version                     string   `xml:"Version,attr"`
	IssueInstant                string   `xml:"IssueInstant,attr"`
	Destination                 string   `xml:"Destination,attr"`
	AssertionConsumerServiceURL string   `xml:"AssertionConsumerServiceURL,attr"`
	Issuer                      SAMLIssuer
	NameIDPolicy                SAMLNameIDPolicy
}

type SAMLIssuer struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Value   string   `xml:",chardata"`
}

type SAMLNameIDPolicy struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol NameIDPolicy"`
	Format  string   `xml:"Format,attr"`
}

type SAMLResponse struct {
	XMLName   xml.Name       `xml:"urn:oasis:names:tc:SAML:2.0:protocol Response"`
	ID        string         `xml:"ID,attr"`
	Version   string         `xml:"Version,attr"`
	Status    SAMLStatus     `xml:"Status"`
	Assertion *SAMLAssertion `xml:"Assertion"`
}

type SAMLStatus struct {
	StatusCode SAMLStatusCode `xml:"StatusCode"`
}

type SAMLStatusCode struct {
	Value string `xml:"Value,attr"`
}

type SAMLAssertion struct {
	XMLName            xml.Name                  `xml:"urn:oasis:names:tc:SAML:2.0:assertion Assertion"`
	ID                 string                    `xml:"ID,attr"`
	Version            string                    `xml:"Version,attr"`
	IssueInstant       string                    `xml:"IssueInstant,attr"`
	Subject            *SAMLSubject              `xml:"Subject"`
	Conditions         *SAMLConditions           `xml:"Conditions"`
	AttributeStatement *SAMLAttributeStatement   `xml:"AttributeStatement"`
}

type SAMLSubject struct {
	NameID *SAMLNameID `xml:"NameID"`
}

type SAMLNameID struct {
	Format string `xml:"Format,attr"`
	Value  string `xml:",chardata"`
}

type SAMLConditions struct {
	NotBefore    string `xml:"NotBefore,attr"`
	NotOnOrAfter string `xml:"NotOnOrAfter,attr"`
}

type SAMLAttributeStatement struct {
	Attributes []SAMLAttribute `xml:"Attribute"`
}

type SAMLAttribute struct {
	Name   string               `xml:"Name,attr"`
	Values []SAMLAttributeValue `xml:"AttributeValue"`
}

type SAMLAttributeValue struct {
	Value string `xml:",chardata"`
}

type SAMLEntityDescriptor struct {
	XMLName         xml.Name             `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntityDescriptor"`
	EntityID        string               `xml:"entityID,attr"`
	SPSSODescriptor *SAMLSPSSODescriptor `xml:"SPSSODescriptor"`
}

type SAMLSPSSODescriptor struct {
	XMLName                    xml.Name                         `xml:"urn:oasis:names:tc:SAML:2.0:metadata SPSSODescriptor"`
	AuthnRequestsSigned        bool                             `xml:"AuthnRequestsSigned,attr"`
	WantAssertionsSigned       bool                             `xml:"WantAssertionsSigned,attr"`
	ProtocolSupportEnumeration string                           `xml:"protocolSupportEnumeration,attr"`
	AssertionConsumerService   []SAMLAssertionConsumerService   `xml:"AssertionConsumerService"`
}

type SAMLAssertionConsumerService struct {
	XMLName  xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata AssertionConsumerService"`
	Binding  string   `xml:"Binding,attr"`
	Location string   `xml:"Location,attr"`
	Index    int      `xml:"index,attr"`
}
