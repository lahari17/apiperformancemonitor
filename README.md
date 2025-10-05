<<<<<<< HEAD
# API Performance Monitor

A comprehensive, full-stack API performance monitoring system that tracks website uptime, response times, and sends intelligent alerts via email and Discord. Built with Go for the backend and Next.js for the frontend dashboard.

![License](https://img.shields.io/badge/license-AGPL%20v3-blue.svg)
![Go Version](https://img.shields.io/badge/go-1.25-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.4.7-black.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)

## 🚀 Features

### Core Monitoring
- **Real-time URL Monitoring**: Monitor multiple URLs with configurable check intervals
- **Performance Tracking**: Track response times and detect slow responses
- **Status Code Validation**: Verify expected HTTP status codes
- **Concurrent Checks**: Efficient concurrent monitoring of multiple endpoints

### Smart Alerting
- **Email Notifications**: HTML and plain text email alerts via SMTP
- **Discord Integration**: Real-time notifications to Discord channels via webhooks
- **Alert Throttling**: Intelligent throttling to prevent spam notifications
- **Recovery Notifications**: Optional alerts when services recover

### Dashboard & API
- **Modern Web Interface**: Clean, responsive Next.js dashboard
- **Real-time Updates**: Live status updates and historical data
- **RESTful API**: Full REST API for programmatic access
- **Pagination**: Efficient handling of large datasets

### Data Management
- **PostgreSQL Storage**: Reliable data persistence with optimized queries
- **Historical Data**: Complete check history with performance metrics
- **Easy URL Management**: Add, edit, and delete monitored URLs
- **Data Export**: Access historical data via API

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js Web   │────│   Go Backend    │────│   PostgreSQL    │
│   Dashboard     │    │   API Server    │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌──────┴──────┐
                       │  Monitoring  │
                       │   Worker     │
                       └──────┬──────┘
                              │
                    ┌─────────┼─────────┐
                    │                   │
            ┌───────▼────────┐  ┌──────▼──────┐
            │ Email Alerts   │  │ Discord Bot │
            └────────────────┘  └─────────────┘
```

### Backend Components (Go)
- **API Server**: Gin-based REST API with CORS support
- **Monitor Runner**: Concurrent URL checker with configurable intervals
- **Alert System**: Multi-channel notification system with throttling
- **Data Store**: PostgreSQL integration with connection pooling
- **Configuration**: Environment-based configuration management

### Frontend Components (Next.js)
- **Dashboard**: Real-time monitoring dashboard with status indicators
- **URL Management**: Interface for adding/removing monitored URLs
- **Historical Charts**: Performance trends and check history
- **Responsive Design**: Mobile-friendly interface

## 📋 Prerequisites

- **Go**: Version 1.25 or higher
- **Node.js**: Version 18 or higher
- **PostgreSQL**: Version 13 or higher
- **SMTP Server**: For email notifications (optional)
- **Discord Webhook**: For Discord notifications (optional)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/lahari17/apiperformancemonitor.git
cd apiperformancemonitor
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb apimonitor

# Run migrations
psql -d apimonitor -f db/migrations/001_init.sql
```

### 3. Backend Configuration
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgres://username:password@localhost/apimonitor

# Monitoring Settings
CHECK_INTERVAL_SECONDS=60
TIMEOUT_MS=5000
SLOW_MS=2000

# Email Configuration (Optional)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password
SMTP_FROM=monitor@yourdomain.com
ALERT_EMAILS=admin@yourdomain.com,ops@yourdomain.com

# Discord Configuration (Optional)
ENABLE_DISCORD=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your/webhook/url

# Alert Settings
ALERT_THROTTLE_MINUTES=15
ALERT_ON_RECOVERY=true

# Server Configuration
PORT=8080
```

### 4. Install Dependencies
```bash
# Backend dependencies
go mod download

# Frontend dependencies
cd web
npm install
cd ..
```

### 5. Build and Run

#### Development Mode
```bash
# Terminal 1: Start backend
go run cmd/api/main.go

# Terminal 2: Start frontend
cd web
npm run dev
```

#### Production Mode
```bash
# Build backend
go build -o apimonitor cmd/api/main.go

# Build frontend
cd web
npm run build
npm start
cd ..

# Run backend
./apimonitor
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `CHECK_INTERVAL_SECONDS` | Monitoring interval | 60 | ❌ |
| `TIMEOUT_MS` | HTTP request timeout | 5000 | ❌ |
| `SLOW_MS` | Slow response threshold | 2000 | ❌ |
| `PORT` | Backend server port | 8080 | ❌ |
| `SMTP_HOST` | SMTP server hostname | - | ❌ |
| `SMTP_PORT` | SMTP server port | 1025 | ❌ |
| `SMTP_USERNAME` | SMTP authentication username | - | ❌ |
| `SMTP_PASSWORD` | SMTP authentication password | - | ❌ |
| `SMTP_FROM` | From email address | - | ❌ |
| `ALERT_EMAILS` | Comma-separated alert recipients | - | ❌ |
| `ENABLE_DISCORD` | Enable Discord notifications | false | ❌ |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL | - | ❌ |
| `ALERT_THROTTLE_MINUTES` | Alert throttling period | 15 | ❌ |
| `ALERT_ON_RECOVERY` | Send recovery notifications | false | ❌ |

## 📖 Usage

### Web Dashboard
1. Open http://localhost:3000 in your browser
2. Add URLs to monitor using the "Add URL" form
3. Configure expected status codes and slow response thresholds
4. Monitor real-time status and historical performance data

### API Endpoints

#### URLs Management
```bash
# List all monitored URLs
GET /urls

# Add a new URL
POST /urls
{
  "url": "https://example.com",
  "expected_status": 200,
  "slow_ms": 1500
}

# Delete a URL
DELETE /urls/:id
```

#### Monitoring Data
```bash
# Get recent checks for a URL
GET /checks?url_id=1&limit=50

# Get latest status for all URLs
GET /status

# Health check
GET /health
```

### Adding URLs via API
```bash
curl -X POST http://localhost:8080/urls \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/health",
    "expected_status": 200,
    "slow_ms": 1000
  }'
```

## 🚨 Alert Types

### Down Alerts
Triggered when:
- HTTP request times out
- Connection fails
- Unexpected status code received

### Slow Alerts
Triggered when:
- Response time exceeds configured threshold
- Status code is correct but performance is degraded

### Recovery Alerts
Triggered when:
- Previously failing service becomes healthy
- Requires `ALERT_ON_RECOVERY=true`

## 🗄️ Database Schema

### URLs Table
```sql
CREATE TABLE urls (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  expected_status INT DEFAULT 200,
  threshold_slow_ms INT DEFAULT 2000,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Checks Table
```sql
CREATE TABLE checks (
  id BIGSERIAL PRIMARY KEY,
  url_id INT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  status_code INT,
  latency_ms INT,
  ok BOOLEAN,
  error TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);
```

## 🔍 Monitoring and Debugging

### Logs
- Backend logs are written to stdout
- Check `server.log` for detailed monitoring activity
- Frontend logs available in browser console

### Health Checks
```bash
# Backend health
curl http://localhost:8080/health

# Database connectivity
curl http://localhost:8080/urls
```

## 🚀 Deployment

### Docker Deployment
```dockerfile
# Backend Dockerfile
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o apimonitor cmd/api/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/apimonitor .
CMD ["./apimonitor"]
```

### Environment Setup
- Set all required environment variables
- Ensure PostgreSQL is accessible
- Configure firewall rules for ports 8080 and 3000
- Set up reverse proxy (nginx/apache) for production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See the [LICENSE](LICENSE) file for details.

For commercial licensing options, contact: info@laharisandepudi.com

## 🐛 Support

- Create an issue on GitHub for bug reports
- Check existing issues before creating new ones
- Provide detailed reproduction steps
- Include environment information

## 🎯 Roadmap

- [ ] Slack integration
- [x] Discord notifications
- [ ] Custom webhook endpoints
- [ ] Metrics export (Prometheus)
- [ ] Mobile app
- [ ] SSL certificate monitoring
- [ ] Multi-region monitoring
- [ ] Advanced analytics dashboard

## 👥 Authors

- **Lahari Sandepudi** - *Initial work* - [lahari17](https://github.com/lahari17)

## 🙏 Acknowledgments

- Built with [Gin](https://gin-gonic.com/) web framework
- Frontend powered by [Next.js](https://nextjs.org/)
- Database management with [pgx](https://github.com/jackc/pgx)
- Email functionality via [jordan-wright/email](https://github.com/jordan-wright/email)

---

For more information, visit the [project repository](https://github.com/lahari17/apiperformancemonitor).
