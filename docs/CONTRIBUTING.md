# 🤝 Contributing to Schlep-engine

Thank you for your interest in contributing to Schlep-engine! This guide provides everything you need to know to contribute effectively to our data processing and machine learning platform.

---

## 🌟 How to Contribute

We welcome contributions of all types:
- 🐛 **Bug fixes** - Help us identify and fix issues
- ✨ **New features** - Add functionality that benefits users
- 📚 **Documentation** - Improve guides, examples, and explanations
- 🧪 **Tests** - Increase coverage and reliability
- 🎨 **UI/UX improvements** - Enhance user experience
- ⚡ **Performance optimizations** - Make things faster and more efficient

---

## 🚀 Quick Start Guide

### 1. Set Up Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/your-username/schlep-engine.git
cd schlep-engine

# Install dependencies
pnpm install

# Set up Python environment
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..

# Copy environment template
cp .env.example .env

# Start development services
docker-compose up -d postgres redis
pnpm dev
```

### 2. Find Something to Work On

**Good First Issues**: Look for issues labeled `good-first-issue` in our [GitHub Issues](https://github.com/wiramahendra/Schlep-engine/issues).

**Areas That Need Help:**
- 📖 Documentation improvements
- 🧪 Test coverage expansion
- 🌐 Internationalization (i18n)
- ♿ Accessibility improvements
- 🐛 Bug fixes and quality improvements

### 3. Create Your Contribution

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... code, test, document ...

# Commit your changes
git add .
git commit -m "feat: add your feature description"

# Push and create pull request
git push origin feature/your-feature-name
```

---

## 📋 Contribution Guidelines

### Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and inclusive in all interactions.

### Development Workflow

**1. Issue First**
- For significant changes, create an issue first to discuss the approach
- Reference the issue number in your PR
- Small bug fixes and typos can skip this step

**2. Branch Naming**
```bash
# Feature branches
feature/add-oauth-integration
feature/improve-data-validation

# Bug fix branches
bugfix/fix-login-redirect
bugfix/resolve-memory-leak

# Documentation branches
docs/update-api-guide
docs/add-deployment-examples

# Refactoring branches
refactor/simplify-auth-flow
refactor/optimize-database-queries
```

**3. Commit Message Format**
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): brief description

Optional longer description explaining the change
and its motivation.

Closes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or modifying tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(auth): add Google OAuth integration

- Implement OAuth 2.0 flow with Google
- Add user profile synchronization
- Update authentication middleware
- Add comprehensive tests

Closes #456

fix(api): resolve memory leak in data processing

The connection pool was not properly releasing connections
after processing large datasets. This fix ensures proper
cleanup and adds monitoring.

Closes #789
```

### Code Standards

**Python (Backend):**
```python
# Use type hints
def process_data(data: Dict[str, Any], options: ProcessingOptions) -> ProcessedData:
    """Process data according to specified options.

    Args:
        data: Input data dictionary
        options: Processing configuration

    Returns:
        Processed data object

    Raises:
        ValidationError: If data is invalid
    """
    pass

# Use proper error handling
try:
    result = risky_operation()
except SpecificException as e:
    logger.error(f"Operation failed: {e}")
    raise ProcessingError(f"Unable to process data: {e}") from e

# Use async/await properly
async def fetch_user_data(user_id: str) -> UserData:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"/api/users/{user_id}") as response:
            response.raise_for_status()
            return UserData.parse_obj(await response.json())
```

**TypeScript (Frontend):**
```typescript
// Use proper types
interface UserProfile {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
}

// Use proper error handling
const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  try {
    const response = await api.get(`/users/${userId}`)
    return response.data
  } catch (error) {
    logger.error('Failed to fetch user profile', { userId, error })
    throw new UserProfileError('Unable to load user profile')
  }
}

// Use proper component structure
export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  onEdit
}) => {
  const [loading, setLoading] = useState(false)

  const handleEdit = useCallback(async () => {
    setLoading(true)
    try {
      await onEdit(user.id)
    } finally {
      setLoading(false)
    }
  }, [user.id, onEdit])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleEdit} disabled={loading}>
          {loading ? 'Saving...' : 'Edit Profile'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

### Testing Requirements

**Every contribution should include tests:**

**Backend Tests:**
```python
# Unit tests
def test_user_creation():
    user = User(email="test@example.com", name="Test User")
    assert user.email == "test@example.com"
    assert user.is_active is True

# Integration tests
async def test_user_login_api():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        assert "access_token" in response.json()

# Test coverage should be >80%
pytest --cov=app tests/ --cov-report=html
```

**Frontend Tests:**
```typescript
// Component tests
describe('UserProfileCard', () => {
  it('displays user information correctly', () => {
    const mockUser = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user'
    }

    render(<UserProfileCard user={mockUser} onEdit={jest.fn()} />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', async () => {
    const mockOnEdit = jest.fn()
    const user = { id: '1', name: 'John Doe' }

    render(<UserProfileCard user={user} onEdit={mockOnEdit} />)

    fireEvent.click(screen.getByText('Edit Profile'))

    expect(mockOnEdit).toHaveBeenCalledWith('1')
  })
})

// Integration tests
describe('User Management Flow', () => {
  it('allows creating and editing users', async () => {
    // Test full user management workflow
  })
})
```

### Documentation Standards

**Code Documentation:**
```python
def calculate_business_impact(
    metrics: Dict[str, float],
    baseline: Dict[str, float],
    thresholds: Dict[str, float]
) -> BusinessImpact:
    """Calculate business impact based on current metrics.

    This function analyzes current system metrics against baseline
    values and predefined thresholds to determine the overall
    business impact of changes or incidents.

    Args:
        metrics: Current system metrics (error_rate, response_time, etc.)
        baseline: Historical baseline values for comparison
        thresholds: Acceptable threshold values for each metric

    Returns:
        BusinessImpact object containing:
        - overall_impact: Float between 0-1 (0=no impact, 1=critical)
        - affected_areas: List of business areas affected
        - recommendations: List of recommended actions

    Raises:
        ValidationError: If required metrics are missing
        CalculationError: If impact calculation fails

    Example:
        >>> metrics = {"error_rate": 0.05, "response_time": 1500}
        >>> baseline = {"error_rate": 0.01, "response_time": 500}
        >>> thresholds = {"max_error_rate": 0.03, "max_response_time": 1000}
        >>> impact = calculate_business_impact(metrics, baseline, thresholds)
        >>> print(impact.overall_impact)
        0.75
    """
```

**README Updates:**
When adding new features, update relevant README files with:
- Feature description
- Usage examples
- Configuration options
- Troubleshooting tips

---

## 🧪 Testing Guidelines

### Running Tests

```bash
# Run all tests
pnpm test

# Run backend tests
cd apps/api && pytest

# Run frontend tests
pnpm --filter @schlep-engine/web-admin test

# Run E2E tests
pnpm test:oauth

# Run tests with coverage
pytest --cov=app tests/ --cov-report=html
pnpm test:coverage
```

### Test Categories

**Unit Tests (70% of tests):**
- Test individual functions and classes
- Fast execution (< 1ms per test)
- No external dependencies

**Integration Tests (20% of tests):**
- Test component interactions
- Database and API integration
- Medium execution time (< 100ms per test)

**E2E Tests (10% of tests):**
- Test complete user workflows
- Browser automation with Cypress
- Slower execution (< 30s per test)

### Writing Good Tests

**Test Structure:**
```python
def test_feature_name():
    # Arrange - Set up test data
    user = UserFactory()
    data = {"email": "test@example.com"}

    # Act - Execute the behavior
    result = process_user_data(user, data)

    # Assert - Verify the outcome
    assert result.success is True
    assert result.user.email == "test@example.com"
```

**Test Naming:**
- Use descriptive names: `test_user_login_with_valid_credentials`
- Include expected behavior: `test_should_return_error_when_email_invalid`
- Group related tests in classes

**Test Data:**
```python
# Use factories for test data
class UserFactory(factory.Factory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    name = factory.Faker("name")

# Use fixtures for reusable setup
@pytest.fixture
async def authenticated_user():
    user = UserFactory()
    await user.save()
    return user
```

---

## 📚 Documentation Contributions

### Types of Documentation

**API Documentation:**
- Endpoint descriptions
- Request/response examples
- Error codes and handling
- Authentication requirements

**User Guides:**
- Step-by-step tutorials
- Common use cases
- Troubleshooting guides
- Best practices

**Developer Documentation:**
- Architecture explanations
- Setup instructions
- Contribution guidelines
- Code examples

### Documentation Standards

**Structure:**
```markdown
# Clear Title

## Overview
Brief description of what this covers

## Prerequisites
What users need before starting

## Step-by-Step Instructions
1. Clear, actionable steps
2. Include code examples
3. Explain expected outcomes

## Troubleshooting
Common issues and solutions

## Related Resources
Links to additional information
```

**Code Examples:**
```markdown
## Example: User Authentication

```python
# Complete, runnable example
from app.auth import authenticate_user

async def login_user(email: str, password: str):
    try:
        user = await authenticate_user(email, password)
        return {"success": True, "user": user}
    except AuthenticationError:
        return {"success": False, "error": "Invalid credentials"}
```

**Expected output:**
```json
{
  "success": true,
  "user": {
    "id": "123",
    "email": "user@example.com"
  }
}
```

### Documentation Review Process

1. **Technical Accuracy**: Code examples work as written
2. **Clarity**: Instructions are easy to follow
3. **Completeness**: All necessary information included
4. **Consistency**: Follows existing documentation style
5. **Accessibility**: Clear language, good structure

---

## 🐛 Bug Reports

### Before Reporting a Bug

1. **Search Existing Issues**: Check if the bug is already reported
2. **Try Latest Version**: Ensure you're using the current version
3. **Minimal Reproduction**: Create smallest possible example
4. **Check Documentation**: Verify it's not expected behavior

### Bug Report Template

```markdown
## Bug Description
Clear description of what the bug is

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Environment
- OS: [e.g., macOS 12.0]
- Browser: [e.g., Chrome 96]
- Version: [e.g., v1.2.3]

## Additional Context
Screenshots, logs, or other helpful information

## Possible Solution
If you have ideas for fixing the bug
```

### Security Issues

**⚠️ Do not create public issues for security vulnerabilities!**

Instead:
1. Email security@schlep-engine.com
2. Include detailed reproduction steps
3. Wait for confirmation before disclosing
4. We'll credit you in our security acknowledgments

---

## ✨ Feature Requests

### Before Requesting a Feature

1. **Check Existing Issues**: Look for similar feature requests
2. **Consider Alternatives**: Could existing features solve your need?
3. **Think About Scope**: Is this a core platform feature?
4. **Gather Use Cases**: Collect examples of when this would be useful

### Feature Request Template

```markdown
## Feature Summary
Brief description of the feature

## Problem Statement
What problem does this solve?

## Proposed Solution
Detailed description of your proposed solution

## Alternative Solutions
Other approaches you've considered

## Use Cases
Specific examples of when this would be useful

## Implementation Notes
Technical considerations or suggestions

## Priority
How important is this feature to you?
- [ ] Nice to have
- [ ] Important for my workflow
- [ ] Blocking my use case
```

### Feature Development Process

1. **Discussion**: Community discusses the feature
2. **Design**: Core team creates technical design
3. **Implementation**: Development work begins
4. **Review**: Code review and testing
5. **Documentation**: Update guides and examples
6. **Release**: Feature included in next version

---

## 🎨 UI/UX Contributions

### Design System

We use a consistent design system based on:
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **Custom Design Tokens**: Colors, spacing, typography

### Component Guidelines

**Accessibility First:**
```typescript
// Always include proper ARIA labels
<Button
  aria-label="Save user profile"
  aria-describedby="save-help-text"
  disabled={loading}
>
  {loading ? <Spinner /> : 'Save Profile'}
</Button>

// Use semantic HTML
<main role="main">
  <h1>Page Title</h1>
  <section aria-labelledby="section-title">
    <h2 id="section-title">Section Title</h2>
  </section>
</main>
```

**Responsive Design:**
```typescript
// Mobile-first approach
<div className="
  flex flex-col space-y-4
  md:flex-row md:space-y-0 md:space-x-6
  lg:space-x-8
">
  <Card className="flex-1">
    <CardContent className="p-4 md:p-6">
      Content
    </CardContent>
  </Card>
</div>
```

**Performance Considerations:**
```typescript
// Use React.memo for expensive components
export const DataVisualization = React.memo<DataVisualizationProps>(({
  data
}) => {
  const processedData = useMemo(() =>
    processLargeDataset(data),
    [data]
  )

  return <Chart data={processedData} />
})

// Lazy load heavy components
const ChartComponent = lazy(() => import('./ChartComponent'))
```

### Design Contribution Process

1. **Create Issue**: Describe the UI/UX problem
2. **Design Mockups**: Create visual designs (Figma preferred)
3. **Get Feedback**: Share with design team
4. **Implement**: Code the approved design
5. **Test**: Verify accessibility and responsiveness
6. **Document**: Update component documentation

---

## 🔧 Infrastructure Contributions

### Areas for Infrastructure Contributions

**Deployment & CI/CD:**
- GitHub Actions workflow improvements
- Docker optimization
- Kubernetes configurations
- Blue-green deployment enhancements

**Monitoring & Observability:**
- Prometheus metrics
- Grafana dashboards
- Alert rule improvements
- Log analysis tools

**Security:**
- Secret rotation automation
- Security scanning tools
- Access control improvements
- Compliance automation

### Infrastructure Guidelines

**Infrastructure as Code:**
```yaml
# Use descriptive names and comments
apiVersion: apps/v1
kind: Deployment
metadata:
  name: schlep-engine-api
  labels:
    app: schlep-engine-api
    component: backend
    version: v1.2.3
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  # ... rest of configuration
```

**Monitoring:**
```yaml
# Include comprehensive monitoring
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: schlep-engine-api
spec:
  selector:
    matchLabels:
      app: schlep-engine-api
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

**Documentation:**
- Document all infrastructure changes
- Include rollback procedures
- Provide troubleshooting guides
- Update runbooks

---

## 🎓 Learning and Growth

### Skill Development

**For New Contributors:**
1. Start with documentation improvements
2. Fix small bugs and typos
3. Add tests to existing code
4. Implement small features
5. Gradually take on larger tasks

**For Experienced Contributors:**
1. Design new features
2. Mentor new contributors
3. Improve architecture
4. Lead technical discussions
5. Contribute to roadmap planning

### Resources

**Internal Learning:**
- Code review participation
- Architecture decision records
- Team technical discussions
- Pair programming sessions

**External Learning:**
- Open source conferences
- Technical blog posts
- Online courses
- Community meetups

### Recognition

We recognize contributions through:
- **Contributor Credits**: Listed in release notes
- **GitHub Contributions**: Your commits and PRs are tracked
- **Community Highlights**: Featured in newsletters
- **Conference Opportunities**: Speaking at events
- **Swag and Rewards**: Stickers, t-shirts, and other items

---

## 💬 Community Guidelines

### Communication Standards

**Be Respectful:**
- Assume positive intent
- Use inclusive language
- Respect different perspectives
- Give constructive feedback

**Be Helpful:**
- Answer questions when you can
- Share knowledge and resources
- Mentor new contributors
- Celebrate others' successes

**Be Professional:**
- Stay on topic in discussions
- Use appropriate channels
- Follow code of conduct
- Represent the project well

### Community Channels

**GitHub:**
- Issues for bugs and features
- Discussions for questions
- Pull requests for contributions
- Wiki for documentation

**Slack (Internal Team):**
- #engineering for technical discussions
- #contributions for external contributions
- #help for questions and support

**Social Media:**
- Twitter: @schlepengine
- LinkedIn: Schlep-engine
- Blog: https://blog.schlep-engine.com

---

## 🎉 Thank You!

Your contributions make Schlep-engine better for everyone. Whether you're fixing a typo, adding a feature, or helping other users, every contribution matters.

### Next Steps

1. **Join Our Community**: Introduce yourself in discussions
2. **Pick Your First Issue**: Look for `good-first-issue` labels
3. **Ask Questions**: Don't hesitate to ask for help
4. **Share Your Ideas**: We'd love to hear your suggestions

### Recognition

Major contributors are recognized in:
- Project README
- Release notes
- Annual contributor report
- Conference talks and blog posts

---

**Happy Contributing! 🚀**

*For questions about contributing, reach out to our maintainers or create a discussion on GitHub.*

*Last Updated: January 2024*
*Contributing Guide Version: 1.0.0*