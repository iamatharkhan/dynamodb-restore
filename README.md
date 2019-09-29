# DynamoDB Restore

Using following AWS serverless components to detect DynamoDB table delete and restore the table from one of the available backups.

* Lambda
* DynamoDB
* SNS
* CloudWatch
* CloudTrail

## Serverless Framework

Serverless Framework is used to generated CF template. All resources are defined in `serverless.yml` file.

## Resources

### Lambda Functions

#### notifyDete

This function is triggered when a DynamoDB table is deleted. It notifies the SNS topic and Slack Webhook endpoint, both should be defined in the environment variables. See `Usage` section for details.

#### notifyRestore

This function is triggered when DynamoDB table is deleted. It attempts to find the available backup for the deleted table. If found, it restores to the latest backup available. It also notifies the SNS topic and Slack Webhook endpoint (both defined in the environment variables) about the backup restoration action.

### DynamoDB table

DynamoDB tabel `myTestingTable` is also created as part of the stack.

### SNS Topic and Subscription

Following SNS topic and subscription are created as part of the stack:

* Topic: DynamoDBTableDelete
* Subscription: Email protocal, values is taken from environment variable `DYNAMODB_TOPIC_EMAIL`

## Usage

### Installation

`npm ci`

### Unit tests

`npm test`

### Environment variables

Following environment variables must be defined before deploying the resources.

* DYNAMODB_TOPIC_EMAIL - Email address where notifications to be sent

* SLACK_WEBHOOK_PATH - Slack Webhook endpoint e.g. `"/services/T0EXAMP/BNUFEXAMP/OJAItxMYEXAMP"`

### Deploy

    Assuming Serverless Framework is globally installed
`npm run deploy`

To remove the stack, run `npm run remove`

### Test data

Run following command to populate the Dynamodb table created as part of the stack

`aws dynamodb batch-write-item --request-items file://batchWrite.json --region eu-west-2`
