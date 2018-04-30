import { Injectable } from '@angular/core';
import {
  JSONSchema, JSONSchemaObject, JSONSchemaEnum, JSONSchemaPrimitive,
  JSONSchemaArray, JSONSchemaString, JSONSchemaNumeric, JSONSchemaConst
} from './json-schema';

/**
 * @todo Add other JSON Schema validation features
 */
@Injectable({
  providedIn: 'root'
})
export class JSONValidator {

  /**
   * Validate a JSON data against a JSON Schema
   * @param data JSON data to validate
   * @param schema Subset of JSON Schema.
   * Types are enforced to validate everything:
   * each value MUST have 'type' or 'properties' or 'items' or 'const' or 'enum'.
   * Therefore, unlike the spec, booleans are not allowed as schemas.
   * Not all validation features are supported: just follow the interface.
   * @returns If data is valid : true, if it is invalid : false, and throws if the schema is invalid
   */
  validate(data: any, schema: JSONSchema): boolean {

    if (schema.hasOwnProperty('const') && (schema as JSONSchemaConst).const !== undefined && (data !== (schema as JSONSchemaConst).const)) {
      return false;
    }

    if (!this.validateEnum(data, schema as JSONSchemaEnum)) {
      return false;
    }

    if (!this.validateType(data, schema as JSONSchemaPrimitive)) {
      return false;
    }

    if (!this.validateItems(data, schema as JSONSchemaArray)) {
      return false;
    }

    if (!this.validateProperties(data, schema as JSONSchemaObject)) {
      return false;
    }

    return true;

  }

  protected isObjectNotNull(value: any): boolean {

    return (value !== null) && (typeof value === 'object');

  }

  protected validateProperties(data: {}, schema: JSONSchemaObject): boolean {

    if (!schema.hasOwnProperty('properties') || (schema.properties == null)) {
      return true;
    }

    if (!this.isObjectNotNull(data)) {

      return false;

    }

    /**
     * Check if the object doesn't have more properties than expected
     * Equivalent of additionalProperties: false
     */
    if (Object.keys(schema.properties).length !== Object.keys(data).length) {

      return false;

    }

    /* Recursively validate all properties */
    for (let property in schema.properties) {

      if (schema.properties.hasOwnProperty(property) && data.hasOwnProperty(property)) {

        if (!this.validate(data[property], schema.properties[property])) {

          return false;

        }

      }

    }

    if (!this.validateRequired(data, schema)) {
      return false;
    }

    return true;

  }

  protected validateRequired(data: {}, schema: JSONSchemaObject): boolean {

    if (!schema.hasOwnProperty('required') || (schema.required == null)) {
      return true;
    }

    if (!this.isObjectNotNull(data)) {

      return false;

    }

    for (let requiredProp of schema.required) {

      /* Checks if the property is present in the schema 'properties' */
      if (!schema.properties || !schema.properties.hasOwnProperty(requiredProp)) {

        throw new Error(`'required' properties must be described in 'properties' too.`);

      }

      /* Checks if the property is present in the data */
      if (!data.hasOwnProperty(requiredProp)) {

        return false;

      }

    }

    return true;

  }

  protected validateEnum(data: any, schema: JSONSchemaEnum): boolean {

    if (!schema.hasOwnProperty('enum') || (schema.enum == null)) {
      return true;
    }

    /** @todo Move to ES2016 .includes() ? */
    return (schema.enum.indexOf(data) !== -1);

  }

  protected validateType(data: any, schema: JSONSchemaPrimitive): boolean {

    if (!schema.hasOwnProperty('type') || (schema.type == null)) {
      return true;
    }

    if ((schema.type === 'null') && (data !== null)) {

      return false;

    }

    if (schema.type === 'string') {

      return this.validateString(data, schema as JSONSchemaString);

    }

    if ((schema.type === 'number') || (schema.type === 'integer')) {

      return this.validateNumber(data, schema as JSONSchemaNumeric);

    }

    if ((schema.type === 'boolean') && (typeof data !== 'boolean')) {

      return false;

    }

    return true;

  }

  protected validateItems(data: any[], schema: JSONSchemaArray): boolean {

    if (!schema.hasOwnProperty('items') || (schema.items == null)) {
      return true;
    }

    if (!Array.isArray(data)) {

      return false;

    }

    if (schema.hasOwnProperty('maxItems') && (schema.maxItems != null)) {

      if (!Number.isInteger(schema.maxItems) || schema.maxItems < 0) {

        throw new Error(`'maxItems' must be a non-negative integer.`);

      }

      if (data.length > schema.maxItems) {
        return false;
      }

    }

    if (schema.hasOwnProperty('minItems') && (schema.minItems != null)) {

      if (!Number.isInteger(schema.minItems) || schema.minItems < 0) {

        throw new Error(`'minItems' must be a non-negative integer.`);

      }

      if (data.length < schema.minItems) {
        return false;
      }

    }

    if (schema.hasOwnProperty('uniqueItems') && (schema.uniqueItems != null)) {

      if (schema.uniqueItems) {

        const dataSet = new Set(data);

        if (data.length !== dataSet.size) {
          return false;
        }

      }

    }

    if (Array.isArray(schema.items)) {

      return this.validateItemsList(data, schema);

    }

    for (let value of data) {

      if (!this.validate(value, schema.items)) {
        return false;
      }

    }

    return true;

  }

  protected validateItemsList(data: any, schema: JSONSchemaArray): boolean {

    const items = schema.items as JSONSchema[];

    if (data.length !== items.length) {

      return false;

    }

    for (let i = 0; i < items.length; i += 1) {

      if (!this.validate(data[i], items[i])) {
        return false;
      }

    }

    return true;

  }

  protected validateString(data: any, schema: JSONSchemaString): boolean {

    if (typeof data !== 'string') {
      return false;
    }

    if (schema.hasOwnProperty('maxLength') && (schema.maxLength != null)) {

      if (!Number.isInteger(schema.maxLength) || schema.maxLength < 0) {

        throw new Error(`'maxLength' must be a non-negative integer.`);

      }

      if (data.length > schema.maxLength) {
        return false;
      }

    }

    if (schema.hasOwnProperty('minLength') && (schema.minLength != null)) {

      if (!Number.isInteger(schema.minLength) || schema.minLength < 0) {

        throw new Error(`'minLength' must be a non-negative integer.`);

      }

      if (data.length < schema.minLength) {
        return false;
      }

    }

    if (schema.hasOwnProperty('pattern') && (schema.pattern != null)) {

      const regularExpression = new RegExp(schema.pattern);

      if (!regularExpression.test(data)) {
        return false;
      }

    }

    return true;

  }

  protected validateNumber(data: any, schema: JSONSchemaNumeric): boolean {

    if (typeof data !== 'number') {
      return false;
    }

    if ((schema.type === 'integer') && !Number.isInteger(data)) {
      return false;
    }

    if (schema.hasOwnProperty('multipleOf') && (schema.multipleOf != null)) {

      if (schema.multipleOf <= 0) {

        throw new Error(`'multipleOf' must be a number strictly greater than 0.`);

      }

      if (!Number.isInteger(data / schema.multipleOf)) {
        return false;
      }

    }

    if (schema.hasOwnProperty('maximum') && (schema.maximum != null)) {

      if (data > schema.maximum) {
        return false;
      }

    }

    if (schema.hasOwnProperty('exclusiveMaximum') && (schema.exclusiveMaximum != null)) {

      if (data >= schema.exclusiveMaximum) {
        return false;
      }

    }

    if (schema.hasOwnProperty('minimum') && (schema.minimum != null)) {

      if (data < schema.minimum) {
        return false;
      }

    }

    if (schema.hasOwnProperty('exclusiveMinimum') && (schema.exclusiveMinimum != null)) {

      if (data <= schema.exclusiveMinimum) {
        return false;
      }

    }

    return true;

  }

}
