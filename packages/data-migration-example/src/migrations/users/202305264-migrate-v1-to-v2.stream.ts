import { DynamoDBStreamHandler } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  PutCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TARGET_TABLE_NAME = 'example-users-v2';

export const handler: DynamoDBStreamHandler = async (event) => {
  console.debug('Event', JSON.stringify(event));

  for (const record of event.Records) {
    if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
      const item = unmarshall(
        record.dynamodb?.NewImage as Record<string, AttributeValue>
      );
      console.debug('Record Item', JSON.stringify(item));

      await docClient.send(
        new PutCommand({
          TableName: TARGET_TABLE_NAME,
          Item: {
            userId: item['id'],
            name: item['name'],
          },
        })
      );
    } else if (record.eventName === 'REMOVE') {
      const keys = unmarshall(
        record.dynamodb?.Keys as Record<string, AttributeValue>
      );
      console.debug('Record Keys', JSON.stringify(keys));

      await docClient.send(
        new DeleteCommand({
          TableName: TARGET_TABLE_NAME,
          Key: {
            userId: keys['id'],
          },
        })
      );
    }
  }

  console.log('Parsed records', event.Records.length);
};
