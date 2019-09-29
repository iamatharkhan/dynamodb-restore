const expect = require('chai').expect;
const proxyquire = require('proxyquire');
const restoreEventHandlerPath = '../handlers/notifyRestore.js';
const deleteEventIAMUser = require('./mocks/deleteEventIAMUser.json');
const nock = require('nock');

describe('Dynamodb table delete event should restore and notify', () => {

  beforeEach(() => {
    process.env.TOPIC_ARN = 'arn:aws:sns:us-east-2:123456789012:MyTopic';
    process.env.SLACK_WEBHOOK_PATH = '/services/123/456/789';
  });

  it('should receive the event by IAMUser and find the backup', async () => {

    const notificationMessage = `Attempting to restore deleted table using backup: ${JSON.stringify({
      backupName: 'bk2',
      backupType: 'User',
      backupCreationDateTime: '2019-09-29T16:20:16Z',
      backupSizeBytes: '215'
    })}`;

    nock('https://hooks.slack.com')
      .post('/services/123/456/789', JSON.stringify({ "text": notificationMessage }))
      .reply(200, 'ok');

    const restoreEventHandlerProxy = proxyquire(restoreEventHandlerPath, {
      'aws-sdk/clients/sns': function (params) {
        expect(params).to.deep.equal({
          apiVersion: '2010-03-31'
        });
        this.publish = (message) => {
          expect(message).to.deep.equal({
            Message: notificationMessage,
            TopicArn: 'arn:aws:sns:us-east-2:123456789012:MyTopic'
          });
          return {
            promise: () => {
              Promise.resolve();
            }
          }
        }
      },
      'aws-sdk/clients/dynamodb': function (params) {
        expect(params).to.deep.equal({
          apiVersion: '2012-08-10'
        });
        this.listBackups = (message) => {
          return {
            promise: () => {
              return Promise.resolve(require('./mocks/listBackups.json'));
            }
          }
        }
        this.waitFor = (message) => {

          return {
            promise: () => {
              Promise.resolve();
            }
          }
        }

        this.restoreTableFromBackup = (message) => {

          return {
            promise: () => {
              Promise.resolve();
            }
          }
        }
      }
    });

    const response = await restoreEventHandlerProxy.handler(deleteEventIAMUser);

    expect(response).to.equal(notificationMessage);

  });

  it('should receive the event by IAMUser and cannot find the backup', async () => {

    const notificationMessage = `DynamoDB table 'myTestingTable' deleted but no backup available to restore the table.`;

    nock('https://hooks.slack.com')
      .post('/services/123/456/789', JSON.stringify({ "text": notificationMessage }))
      .reply(200, 'ok');

    const restoreEventHandlerProxy = proxyquire(restoreEventHandlerPath, {
      'aws-sdk/clients/sns': function () {
        this.publish = (message) => {
          expect(message).to.deep.equal({
            Message: notificationMessage,
            TopicArn: 'arn:aws:sns:us-east-2:123456789012:MyTopic'
          });
          return {
            promise: () => {
              Promise.resolve();
            }
          }
        }
      },
      'aws-sdk/clients/dynamodb': function () {
        this.listBackups = (message) => {
          return {
            promise: () => {
              return Promise.resolve({ BackupSummaries: [] });
            }
          }
        }
      }
    });

    const response = await restoreEventHandlerProxy.handler(deleteEventIAMUser);

    expect(response).to.equal(notificationMessage);

  });

  it('should receive the event by IAMUser and cannot find the backup because none is in AVAILABLE state', async () => {

    const notificationMessage = `DynamoDB table 'myTestingTable' deleted but no backup available to restore the table.`;

    nock('https://hooks.slack.com')
      .post('/services/123/456/789', JSON.stringify({ "text": notificationMessage }))
      .reply(200, 'ok');

    const restoreEventHandlerProxy = proxyquire(restoreEventHandlerPath, {
      'aws-sdk/clients/sns': function () {
        this.publish = (message) => {
          expect(message).to.deep.equal({
            Message: notificationMessage,
            TopicArn: 'arn:aws:sns:us-east-2:123456789012:MyTopic'
          });
          return {
            promise: () => {
              Promise.resolve();
            }
          }
        }
      },
      'aws-sdk/clients/dynamodb': function () {
        this.listBackups = (message) => {
          return {
            promise: () => {
              return Promise.resolve({ BackupSummaries: [{ BackupStatus: 'PENDING' }] });
            }
          }
        }
      }
    });

    const response = await restoreEventHandlerProxy.handler(deleteEventIAMUser);

    expect(response).to.equal(notificationMessage);

  });
});