# Load Testing with k6

## Prerequisites
```bash
# Install k6
brew install k6          # macOS
sudo apt-get install k6  # Ubuntu
npm install -g k6        # npm
```

## Run Tests

### Spike Test (2 min)
```bash
k6 run --vus 10 --duration 2m spike-test.js
k6 run --vus 10 --duration 2m -e BASE_URL=https://staging-chatbot.redegal.com spike-test.js
```

### Stress Test (25 min)
```bash
k6 run stress-test.js
```

### Soak Test (40 min - detect memory leaks)
```bash
k6 run soak-test.js
# Adjust duration in script for quicker testing
```

### Health Check (continuous)
```bash
k6 run health-check.js
```

## Results Interpretation

### Key Metrics
- **HTTP Request Duration**: Response time percentiles (p95, p99)
- **HTTP Request Failed**: Percentage of failed requests
- **Checks**: Validation pass rate
- **Virtual Users (VUs)**: Concurrent users at peak

### Acceptable Thresholds
- p95 response time: < 300ms
- p99 response time: < 500ms
- Failed requests: < 5%
- Success checks: > 95%

## Cloud Integration (k6 Cloud)
```bash
# Register at https://app.k6.io
k6 cloud spike-test.js
k6 cloud stress-test.js
k6 cloud soak-test.js
```

## CI/CD Integration
Add to .gitlab-ci.yml or GitHub Actions:
```yaml
load_test:
  stage: test
  image: loadimpact/k6:latest
  script:
    - k6 run tests/load-tests/spike-test.js
    - k6 run tests/load-tests/stress-test.js
  only:
    - tags
```

## Monitoring
- Open source: Grafana + InfluxDB
- Cloud: k6 Cloud dashboard
- Self-hosted: Prometheus + Grafana
