using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using SchlepEngine.Exceptions;
using SchlepEngine.Types;
using Xunit;

namespace SchlepEngine.Tests;

/// <summary>
/// Unit tests for SchlepClient.
/// </summary>
public class SchlepClientTests : IDisposable
{
    private readonly Mock<HttpMessageHandler> _httpMessageHandlerMock;
    private readonly HttpClient _httpClient;
    private readonly Mock<ILogger<SchlepClient>> _loggerMock;
    private readonly JsonSerializerOptions _jsonOptions;

    public SchlepClientTests()
    {
        _httpMessageHandlerMock = new Mock<HttpMessageHandler>();
        _httpClient = new HttpClient(_httpMessageHandlerMock.Object);
        _loggerMock = new Mock<ILogger<SchlepClient>>();
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        };
    }

    [Fact]
    public async Task UploadAsync_Success_ReturnsUploadResponse()
    {
        // Arrange
        var expectedResponse = new UploadResponse
        {
            JobId = "upload_123",
            Status = "processing",
            Message = "Upload successful"
        };

        SetupHttpResponse(HttpStatusCode.OK, expectedResponse);

        using var client = new SchlepClient("test-api-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act
        var result = await client.UploadAsync("test data");

        // Assert
        Assert.Equal("upload_123", result.JobId);
        Assert.Equal("processing", result.Status);
        Assert.Equal("Upload successful", result.Message);

        VerifyHttpRequest(HttpMethod.Post, "/upload", "test data");
    }

    [Fact]
    public async Task TrainAsync_WithConfig_Success_ReturnsTrainResponse()
    {
        // Arrange
        var expectedResponse = new TrainResponse
        {
            JobId = "train_456",
            ModelId = "model_789",
            Status = "training",
            Message = "Training started"
        };

        SetupHttpResponse(HttpStatusCode.OK, expectedResponse);

        var config = new TrainConfig
        {
            ModelType = "classification",
            DatasetId = "upload_123"
        };

        using var client = new SchlepClient("test-api-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act
        var result = await client.TrainAsync(config);

        // Assert
        Assert.Equal("train_456", result.JobId);
        Assert.Equal("model_789", result.ModelId);
        Assert.Equal("training", result.Status);
        Assert.Equal("Training started", result.Message);

        VerifyHttpRequest(HttpMethod.Post, "/train");
    }

    [Fact]
    public async Task TrainAsync_WithJsonString_Success_ReturnsTrainResponse()
    {
        // Arrange
        var expectedResponse = new TrainResponse
        {
            JobId = "train_456",
            ModelId = "model_789",
            Status = "training"
        };

        SetupHttpResponse(HttpStatusCode.OK, expectedResponse);

        var configJson = "{\"model_type\":\"classification\",\"dataset_id\":\"upload_123\"}";

        using var client = new SchlepClient("test-api-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act
        var result = await client.TrainAsync(configJson);

        // Assert
        Assert.Equal("train_456", result.JobId);
        Assert.Equal("model_789", result.ModelId);
        Assert.Equal("training", result.Status);

        VerifyHttpRequest(HttpMethod.Post, "/train");
    }

    [Fact]
    public async Task DeployAsync_Success_ReturnsDeployResponse()
    {
        // Arrange
        var expectedResponse = new DeployResponse
        {
            DeploymentId = "deploy_101",
            EndpointUrl = "https://api.schlep-engine.com/models/model_789/predict",
            Status = "deployed",
            Message = "Model deployed successfully"
        };

        SetupHttpResponse(HttpStatusCode.OK, expectedResponse);

        using var client = new SchlepClient("test-api-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act
        var result = await client.DeployAsync("model_789");

        // Assert
        Assert.Equal("deploy_101", result.DeploymentId);
        Assert.Equal("https://api.schlep-engine.com/models/model_789/predict", result.EndpointUrl);
        Assert.Equal("deployed", result.Status);
        Assert.Equal("Model deployed successfully", result.Message);

        VerifyHttpRequest(HttpMethod.Post, "/deploy");
    }

    [Fact]
    public async Task StatusAsync_Success_ReturnsStatusResponse()
    {
        // Arrange
        var expectedResponse = new StatusResponse
        {
            JobId = "job_123",
            Status = "completed",
            Progress = 100.0f,
            CreatedAt = "2024-01-01T00:00:00Z",
            UpdatedAt = "2024-01-01T01:00:00Z"
        };

        SetupHttpResponse(HttpStatusCode.OK, expectedResponse);

        using var client = new SchlepClient("test-api-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act
        var result = await client.StatusAsync("job_123");

        // Assert
        Assert.Equal("job_123", result.JobId);
        Assert.Equal("completed", result.Status);
        Assert.Equal(100.0f, result.Progress);
        Assert.Equal("2024-01-01T00:00:00Z", result.CreatedAt);
        Assert.Equal("2024-01-01T01:00:00Z", result.UpdatedAt);

        VerifyHttpRequest(HttpMethod.Get, "/status/job_123");
    }

    [Fact]
    public async Task ApiCall_InvalidApiKey_ThrowsApiException()
    {
        // Arrange
        var errorResponse = new { message = "Invalid API key" };
        SetupHttpResponse(HttpStatusCode.Unauthorized, errorResponse);

        using var client = new SchlepClient("invalid-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ApiException>(() => client.UploadAsync("test data"));
        Assert.Equal(401, exception.StatusCode);
        Assert.Equal("Invalid API key", exception.Message.Split(':')[1].Trim());
    }

    [Fact]
    public async Task ApiCall_BadRequest_ThrowsApiException()
    {
        // Arrange
        var errorResponse = new { message = "Invalid training configuration" };
        SetupHttpResponse(HttpStatusCode.BadRequest, errorResponse);

        var config = new TrainConfig
        {
            ModelType = "invalid",
            DatasetId = "nonexistent"
        };

        using var client = new SchlepClient("test-api-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ApiException>(() => client.TrainAsync(config));
        Assert.Equal(400, exception.StatusCode);
        Assert.Contains("Invalid training configuration", exception.Message);
    }

    [Fact]
    public void Constructor_EmptyApiKey_ThrowsConfigurationException()
    {
        // Act & Assert
        Assert.Throws<ConfigurationException>(() => new SchlepClient(""));
        Assert.Throws<ConfigurationException>(() => new SchlepClient(null!));
        Assert.Throws<ConfigurationException>(() => new SchlepClient("   "));
    }

    [Fact]
    public void FromEnvironment_MissingEnvVar_ThrowsConfigurationException()
    {
        // Arrange
        Environment.SetEnvironmentVariable("SCHLEP_API_KEY", null);

        // Act & Assert
        Assert.Throws<ConfigurationException>(() => SchlepClient.FromEnvironment());
    }

    [Fact]
    public void FromEnvironment_ValidEnvVar_CreatesClient()
    {
        // Arrange
        Environment.SetEnvironmentVariable("SCHLEP_API_KEY", "test-key");

        try
        {
            // Act
            using var client = SchlepClient.FromEnvironment(_httpClient, _loggerMock.Object);

            // Assert
            Assert.NotNull(client);
            Assert.Equal("https://api.schlep-engine.com/v1", client.BaseUrl);
        }
        finally
        {
            Environment.SetEnvironmentVariable("SCHLEP_API_KEY", null);
        }
    }

    [Fact]
    public async Task StreamAsync_Success_DoesNotThrow()
    {
        // Arrange
        var config = new StreamConfig
        {
            EventTypes = new List<string> { "training", "deployment" },
            Filters = new Dictionary<string, object> { { "user_id", "123" } }
        };

        using var client = new SchlepClient("test-api-key", "https://api.test.com/v1", _httpClient, _loggerMock.Object);

        // Act & Assert
        await client.StreamAsync(config);
        // This is a placeholder test since streaming is not fully implemented
    }

    [Fact]
    public void TrainConfig_Properties_WorkCorrectly()
    {
        // Arrange & Act
        var config = new TrainConfig
        {
            ModelType = "classification",
            DatasetId = "dataset_123",
            Parameters = new Dictionary<string, object>
            {
                { "algorithm", "random_forest" },
                { "test_size", 0.2 }
            }
        };

        // Assert
        Assert.Equal("classification", config.ModelType);
        Assert.Equal("dataset_123", config.DatasetId);
        Assert.Equal("random_forest", config.Parameters["algorithm"]);
        Assert.Equal(0.2, config.Parameters["test_size"]);
    }

    private void SetupHttpResponse<T>(HttpStatusCode statusCode, T responseObject)
    {
        var json = JsonSerializer.Serialize(responseObject, _jsonOptions);
        var response = new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };

        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(response);
    }

    private void VerifyHttpRequest(HttpMethod method, string expectedPath, string? expectedBodyContent = null)
    {
        _httpMessageHandlerMock
            .Protected()
            .Verify(
                "SendAsync",
                Times.Once(),
                ItExpr.Is<HttpRequestMessage>(req =>
                    req.Method == method &&
                    req.RequestUri!.AbsolutePath == expectedPath &&
                    req.Headers.Authorization!.Scheme == "Bearer" &&
                    req.Headers.Authorization.Parameter == "test-api-key" &&
                    (expectedBodyContent == null ||
                     req.Content!.ReadAsStringAsync().Result.Contains(expectedBodyContent))),
                ItExpr.IsAny<CancellationToken>());
    }

    public void Dispose()
    {
        _httpClient?.Dispose();
    }
}