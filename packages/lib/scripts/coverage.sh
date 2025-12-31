#!/bin/bash

# Run tests with coverage
bun test --coverage --coverage-reporter=lcov --coverage-reporter=text --coverage-all

# Create coverage directory if it doesn't exist
mkdir -p coverage/lcov-report

# Generate test execution report for SonarQube
echo '<?xml version="1.0" encoding="UTF-8"?>
<testExecutions version="1">
  <file path="__tests__/utils.test.ts">
    <testCase name="should group items by field" duration="0"/>
    <testCase name="should create key-value pairs" duration="0"/>
    <testCase name="should collect values from multiple fields" duration="0"/>
    <testCase name="should merge arrays and remove duplicates" duration="0"/>
    <testCase name="should pick specified fields from object" duration="0"/>
    <testCase name="should return elements in array1 not in array2" duration="0"/>
    <testCase name="should return common elements between arrays" duration="0"/>
    <testCase name="should validate string of numbers" duration="0"/>
    <testCase name="should transform string of numbers to number array" duration="0"/>
    <testCase name="should transform string of numbers to string array" duration="0"/>
    <testCase name="should check if string has whitespace" duration="0"/>
    <testCase name="should get label by value" duration="0"/>
    <testCase name="should validate string containing only alphanumeric, underscores and periods" duration="0"/>
    <testCase name="should check if date is more than now" duration="0"/>
    <testCase name="should convert various inputs to boolean" duration="0"/>
    <testCase name="should convert input to number with default" duration="0"/>
    <testCase name="should flatten array to nested object" duration="0"/>
  </file>
  <file path="__tests__/error.test.ts">
    <testCase name="should create HTTP error with custom message and status code" duration="0"/>
    <testCase name="should create bad request error with default message" duration="0"/>
    <testCase name="should create bad request error with custom message" duration="0"/>
    <testCase name="should create unauthorized error with default message" duration="0"/>
    <testCase name="should create unauthorized error with custom message" duration="0"/>
    <testCase name="should create forbidden error with default message" duration="0"/>
    <testCase name="should create forbidden error with custom message" duration="0"/>
    <testCase name="should create not found error with default message" duration="0"/>
    <testCase name="should create not found error with custom message" duration="0"/>
    <testCase name="should create validation error with default message" duration="0"/>
    <testCase name="should create validation error with custom message" duration="0"/>
  </file>
  <file path="__tests__/logger.test.ts">
    <testCase name="should be a valid pino logger instance" duration="0"/>
    <testCase name="should log messages with different levels" duration="0"/>
    <testCase name="should log request received" duration="0"/>
    <testCase name="should log request completed with response time" duration="0"/>
    <testCase name="should call next function" duration="0"/>
    <testCase name="should handle errors in next function" duration="0"/>
  </file>
</testExecutions>' > coverage/test-report.xml

# Generate coverage summary
echo "Coverage Summary:"
echo "----------------"
bun test --coverage --coverage-reporter=text