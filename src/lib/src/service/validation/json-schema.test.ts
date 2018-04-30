import { JSONSchema } from './json-schema';

/* All below should fail */

const schemaEmpty: JSONSchema = {};

const schemaConstInvalid: JSONSchema = {
  const: {}
};

const schemaConstWithOthers: JSONSchema = {
  const: 'test',
  maximum: 2
};

const schemaEnumInvalid: JSONSchema = {
  enum: [{}]
};

const schemaEnumWithOthers: JSONSchema = {
  enum: ['test'],
  maximum: 1
};

const schemaBooleanWithOthers: JSONSchema = {
  type: 'boolean',
  maximum: 1
};

const schemaNullWithOthers: JSONSchema = {
  type: 'null',
  maximum: 1
};

const schemaStringInvalid: JSONSchema = {
  type: 'string',
  minLength: 'test'
};

const schemaStringWithOthers: JSONSchema = {
  type: 'string',
  maximum: 1
};

const schemaNumberInvalid: JSONSchema = {
  type: 'number',
  maximum: 'test'
};

const schemaNumberWithOthers: JSONSchema = {
  type: 'number',
  minLength: 1
};

const schemaIntegerInvalid: JSONSchema = {
  type: 'integer',
  maximum: 'test'
};

const schemaIntegerWithOthers: JSONSchema = {
  type: 'integer',
  minLength: 1
};

const schemaArrayInvalid: JSONSchema = {
  items: [{ type: 'string' }],
  minItems: 'test'
};

const schemaArrayWithOthers: JSONSchema = {
  items: [{ type: 'string' }],
  minLength: 1
};

const schemaObjectInvalid: JSONSchema = {
  properties: { test: { type: 'string' } },
  required: 'test'
};

const schemaObjectWithOthers: JSONSchema = {
  properties: { test: { type: 'string' } },
  minLength: 1
};

const schemaTypeInvalid1: JSONSchema = {
  type: 'toto'
};

const schemaTypeInvalid2: JSONSchema = {
  type: ['string', 'number']
};



