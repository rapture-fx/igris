package providers

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"net/smtp"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/alerts"
)

// EmailProvider sends alerts via SMTP email
type EmailProvider struct {
	config     *EmailConfig
	auth       smtp.Auth
	htmlTemplate *template.Template
}

// EmailConfig holds SMTP configuration
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	Username     string
	Password     string
	FromAddress  string
	FromName     string
	UseTLS       bool
	Timeout      time.Duration
}

// NewEmailProvider creates a new email alert provider
func NewEmailProvider(config *EmailConfig) (*EmailProvider, error) {
	if config == nil {
		return nil, fmt.Errorf("config cannot be nil")
	}

	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	// Setup SMTP authentication
	var auth smtp.Auth
	if config.Username != "" && config.Password != "" {
		auth = smtp.PlainAuth("", config.Username, config.Password, config.SMTPHost)
	}

	// Parse HTML template
	tmpl, err := template.New("alert_email").Parse(emailHTMLTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse email template: %w", err)
	}

	return &EmailProvider{
		config:       config,
		auth:         auth,
		htmlTemplate: tmpl,
	}, nil
}

// Send sends an alert via email
func (p *EmailProvider) Send(ctx context.Context, alert *alerts.Alert) error {
	if len(alert.Recipients) == 0 {
		return fmt.Errorf("no email recipients specified")
	}

	// Build email message
	message, err := p.buildEmailMessage(alert)
	if err != nil {
		return fmt.Errorf("failed to build email message: %w", err)
	}

	// Send email
	addr := fmt.Sprintf("%s:%d", p.config.SMTPHost, p.config.SMTPPort)

	err = smtp.SendMail(
		addr,
		p.auth,
		p.config.FromAddress,
		alert.Recipients,
		message,
	)

	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// GetName returns the provider name
func (p *EmailProvider) GetName() string {
	return "email"
}

// ValidateConfig validates the email configuration
func (p *EmailProvider) ValidateConfig() error {
	if p.config.SMTPHost == "" {
		return fmt.Errorf("SMTP host is required")
	}
	if p.config.SMTPPort == 0 {
		return fmt.Errorf("SMTP port is required")
	}
	if p.config.FromAddress == "" {
		return fmt.Errorf("from address is required")
	}
	return nil
}

// buildEmailMessage constructs an email message from an alert
func (p *EmailProvider) buildEmailMessage(alert *alerts.Alert) ([]byte, error) {
	var buf bytes.Buffer

	// Email headers
	from := p.config.FromAddress
	if p.config.FromName != "" {
		from = fmt.Sprintf("%s <%s>", p.config.FromName, p.config.FromAddress)
	}

	subject := fmt.Sprintf("[%s] %s: %s",
		strings.ToUpper(string(alert.Severity)),
		strings.ToUpper(string(alert.Type)),
		alert.Title,
	)

	buf.WriteString(fmt.Sprintf("From: %s\r\n", from))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(alert.Recipients, ", ")))
	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	buf.WriteString("\r\n")

	// Email body (HTML)
	htmlBody, err := p.renderHTMLBody(alert)
	if err != nil {
		return nil, err
	}

	buf.WriteString(htmlBody)

	return buf.Bytes(), nil
}

// renderHTMLBody renders the HTML email body
func (p *EmailProvider) renderHTMLBody(alert *alerts.Alert) (string, error) {
	data := struct {
		Alert          *alerts.Alert
		SeverityColor  string
		FormattedTime  string
		DetailsEntries []struct{ Key, Value string }
	}{
		Alert:         alert,
		SeverityColor: p.severityToColor(alert.Severity),
		FormattedTime: alert.Timestamp.Format("2006-01-02 15:04:05 MST"),
	}

	// Convert details map to slice for template
	for key, value := range alert.Details {
		if key != "delivery_errors" && key != "failed_at" {
			data.DetailsEntries = append(data.DetailsEntries, struct{ Key, Value string }{
				Key:   key,
				Value: fmt.Sprintf("%v", value),
			})
		}
	}

	var buf bytes.Buffer
	if err := p.htmlTemplate.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// severityToColor maps severity to HTML color
func (p *EmailProvider) severityToColor(severity alerts.AlertSeverity) string {
	switch severity {
	case alerts.SeverityInfo:
		return "#36a64f" // Green
	case alerts.SeverityWarning:
		return "#FFA500" // Orange
	case alerts.SeverityError:
		return "#E01E5A" // Red
	case alerts.SeverityCritical:
		return "#8B0000" // Dark red
	default:
		return "#808080" // Gray
	}
}

// emailHTMLTemplate is the HTML template for alert emails
const emailHTMLTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background-color: {{.SeverityColor}};
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .severity-badge {
            display: inline-block;
            background-color: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 15px;
            margin-top: 10px;
            font-size: 14px;
            text-transform: uppercase;
        }
        .content {
            padding: 30px;
        }
        .message {
            font-size: 16px;
            line-height: 1.6;
            color: #333333;
            margin-bottom: 20px;
        }
        .details {
            background-color: #f9f9f9;
            border-left: 4px solid {{.SeverityColor}};
            padding: 15px;
            margin: 20px 0;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
        }
        .details-table td {
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .details-table td:first-child {
            font-weight: bold;
            color: #666666;
            width: 30%;
        }
        .footer {
            background-color: #f4f4f4;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666666;
        }
        .button {
            display: inline-block;
            background-color: {{.SeverityColor}};
            color: #ffffff;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.Alert.Title}}</h1>
            <div class="severity-badge">{{.Alert.Severity}}</div>
        </div>
        <div class="content">
            <div class="message">
                {{.Alert.Message}}
            </div>

            <div class="details">
                <table class="details-table">
                    <tr>
                        <td>Tenant ID:</td>
                        <td>{{.Alert.TenantID}}</td>
                    </tr>
                    <tr>
                        <td>Type:</td>
                        <td>{{.Alert.Type}}</td>
                    </tr>
                    <tr>
                        <td>Timestamp:</td>
                        <td>{{.FormattedTime}}</td>
                    </tr>
                    {{if .Alert.TraceID}}
                    <tr>
                        <td>Trace ID:</td>
                        <td>{{.Alert.TraceID}}</td>
                    </tr>
                    {{end}}
                    {{range .DetailsEntries}}
                    <tr>
                        <td>{{.Key}}:</td>
                        <td>{{.Value}}</td>
                    </tr>
                    {{end}}
                </table>
            </div>

            {{if .Alert.RunbookURL}}
            <div style="text-align: center;">
                <a href="{{.Alert.RunbookURL}}" class="button">View Runbook</a>
            </div>
            {{end}}
        </div>
        <div class="footer">
            <p>This is an automated alert from Igris Inertial</p>
            <p>Alert ID: {{.Alert.ID}}</p>
        </div>
    </div>
</body>
</html>
`
