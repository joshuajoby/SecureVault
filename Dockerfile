# Simple Dockerfile for development
FROM golang:1.20 as builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o /bankapp ./

FROM alpine:3.18
RUN apk add --no-cache ca-certificates
COPY --from=builder /bankapp /bankapp
EXPOSE 8080
ENTRYPOINT ["/bankapp"]