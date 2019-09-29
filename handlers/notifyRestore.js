'use strict';

const SNS = require('aws-sdk/clients/sns');
const DynamoDB = require('aws-sdk/clients/dynamodb');

// Lock API version.
const sns = new SNS({
  apiVersion: '2010-03-31'
});

const ddb = new DynamoDB({
  apiVersion: '2012-08-10'
});

const https = require('https');

/**
 * Post data to Slack webhook integration endpoint.
 *
 * @param {string} data
 * @returns
 */
let slackRequest = (data) => {

  return new Promise((resolve, reject) => {

    const options = {
      hostname: 'hooks.slack.com',
      path: process.env.SLACK_WEBHOOK_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }

    const req = https.request(options, (res) => res.on('data', (d) => resolve(d)));
    req.on('error', (error) => reject(error));
    req.write(data);
    req.end();
  });
}

module.exports.handler = async (event) => {

  try {

    // Notification message to be attached.
    let eventDetails;

    // Find the backups for the table.
    const backups = await ddb.listBackups({
      TableName: event.detail.requestParameters.tableName,
      Limit: 10,
      BackupType: 'ALL'
    }).promise();

    // Check for available backups.
    let availableBackups = backups.BackupSummaries.filter(bk => bk.BackupStatus === 'AVAILABLE');

    // Prepare notification message for both cases, backup found or not found.
    if (!availableBackups.length) {
      eventDetails = `DynamoDB table '${event.detail.requestParameters.tableName}' deleted but no backup available to restore the table.`;
    } else {

      // Sort by creation date desc. We want to restore to the latest available backup.
      availableBackups.sort((a, b) => {
        return new Date(b.BackupCreationDateTime).getTime() - new Date(a.BackupCreationDateTime).getTime();
      });

      // Create notification event.
      eventDetails = `Attempting to restore deleted table using backup: ${JSON.stringify({
        backupName: availableBackups[0].BackupName,
        backupType: availableBackups[0].BackupType,
        backupCreationDateTime: availableBackups[0].BackupCreationDateTime,
        backupSizeBytes: availableBackups[0].BackupSizeBytes
      })}`;
    }

    // Send out notifications.
    // Don't `await` here, carry on doing restoration tasks.
    const notificationSent = Promise.all([
      // SNS topic.
      sns.publish({
        Message: eventDetails,
        TopicArn: process.env.TOPIC_ARN
      }).promise(),
      // Slack webhook request.
      slackRequest(JSON.stringify({
        text: eventDetails
      }))
    ]);

    // Perform restoration tasks, if applied.
    if (availableBackups.length) {

      // Wait until table name becomes avaialable.
      await ddb.waitFor('tableNotExists', {
        TableName: event.detail.requestParameters.tableName
      }).promise();

      // Restore from the latest.
      await ddb.restoreTableFromBackup({
        BackupArn: availableBackups[0].BackupArn,
        TargetTableName: event.detail.requestParameters.tableName
      }).promise();
    }

    // Notification promise.
    await notificationSent;
    return eventDetails;
  }
  catch (e) {
    console.log(e);
  }
}