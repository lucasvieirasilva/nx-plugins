import { Schema } from 'dynamoose';

export const StateSchema = new Schema({
  namespace: {
    type: String,
    hashKey: true,
  },
  version: {
    type: Number,
    rangeKey: true,
  },
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    index: {
      name: 'status-index',
      type: 'global',
    },
  },
  startDate: Date,
  endDate: Date,
  rollbackStartDate: Date,
  rollbackEndDate: Date,
  errorMessage: String,
  description: String,
  migrationPath: String,
});
