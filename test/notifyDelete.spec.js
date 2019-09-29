const expect = require('chai').expect;
const proxyquire = require('proxyquire');
const deleteEventHandlerPath = '../handlers/notifyDelete.js';
const deleteEventIAMUser = require('./mocks/deleteEventIAMUser.json');
const deleteEventAssumedRole = require('./mocks/deleteEventAssumedRole.json');
const nock = require('nock');

describe('Dynamodb table delete event should notify', () => {

  beforeEach(() => {
    process.env.TOPIC_ARN = 'arn:aws:sns:us-east-2:123456789012:MyTopic';
    process.env.SLACK_WEBHOOK_PATH = '/services/123/456/789';
  });

  it('should receive the event by IAMUser', async () => {

    const notificationMessage = JSON.stringify({
      tableName: 'myTestingTable',
      deletionTime: '2019-09-29T15:09:55Z',
      principalId: 'AIDAJTOOFOYUBOB25GDSU',
      iamUser: 'bob',
      accountId: '12356789012',
      assumedRole: 'n/a'
    });

    nock('https://hooks.slack.com')
      .post('/services/123/456/789', JSON.stringify({ "text": notificationMessage }))
      .reply(200, 'ok');

    const deleteEventHandlerProxy = proxyquire(deleteEventHandlerPath, {
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
      }
    });

    const response = await deleteEventHandlerProxy.handler(deleteEventIAMUser);

    expect(response).to.equal(notificationMessage);

  });

  it('should receive the event by AssumedRoke', async () => {

    const notificationMessage = JSON.stringify({
      tableName: 'myTestingTable',
      deletionTime: '2019-09-29T17:24:19Z',
      principalId: 'AROAJRGF6BOB123JJSDBKI:bob',
      iamUser: 'n/a',
      accountId: '12356789012',
      assumedRole: 'Developer'
    });

    nock('https://hooks.slack.com')
      .post('/services/123/456/789', JSON.stringify({ "text": notificationMessage }))
      .reply(200, 'ok');

    const deleteEventHandlerProxy = proxyquire(deleteEventHandlerPath, {
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
      }
    });

    const response = await deleteEventHandlerProxy.handler(deleteEventAssumedRole);

    expect(response).to.equal(notificationMessage);

  });
});