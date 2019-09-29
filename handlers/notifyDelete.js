'use strict';

const SNS = require('aws-sdk/clients/sns');
// Lock API version.
const sns = new SNS({
  apiVersion: '2010-03-31'
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

    const isAssumedRole = event.detail.userIdentity.type === 'AssumedRole';

    // Notification message.
    const eventDetails = JSON.stringify({
      tableName: event.detail.requestParameters.tableName,
      deletionTime: event.detail.eventTime,
      principalId: event.detail.userIdentity.principalId,
      iamUser: !isAssumedRole ? event.detail.userIdentity.userName : 'n/a',
      accountId: event.detail.userIdentity.accountId,
      assumedRole: isAssumedRole ? event.detail.userIdentity.sessionContext.sessionIssuer.userName : 'n/a'
    });

    await Promise.all([
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

    return eventDetails;
  }
  catch (e) {
    console.log(e);
  }
}