// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  findSchemaFixture,
  getSchemaMockFixture,
  sampleSchema,
} from './schema-mock.mjs';

describe('sampleSchema', () => {
  const spec = {
    components: {
      schemas: {
        Widget: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            active: { type: 'boolean' },
            tag: { type: 'string', enum: ['A', 'B'] },
            note: { type: 'string', default: 'preset' },
          },
        },
      },
    },
  };

  it('resolves a $ref against components.schemas', () => {
    expect(sampleSchema(spec, { $ref: '#/components/schemas/Widget' })).toEqual(
      {
        id: 0,
        name: '',
        active: false,
        tag: 'A',
        note: 'preset',
      }
    );
  });

  it('prefers the non-null branch of anyOf', () => {
    const schema = { anyOf: [{ type: 'string' }, { type: 'null' }] };
    expect(sampleSchema(spec, schema)).toBe('');
  });

  it('returns null when every anyOf branch is null', () => {
    const schema = { anyOf: [{ type: 'null' }] };
    expect(sampleSchema(spec, schema)).toBeNull();
  });

  it('uses an explicit default over type-based sampling', () => {
    expect(sampleSchema(spec, { type: 'array', default: [] })).toEqual([]);
  });

  it('uses the first enum value when there is no default', () => {
    expect(sampleSchema(spec, { type: 'string', enum: ['X', 'Y'] })).toBe('X');
  });

  it('samples one element for an array without a default', () => {
    const schema = { type: 'array', items: { type: 'integer' } };
    expect(sampleSchema(spec, schema)).toEqual([0]);
  });

  it('returns {} for an object schema with no declared properties', () => {
    expect(sampleSchema(spec, { type: 'object' })).toEqual({});
  });

  it('caps recursion depth on self-referential schemas instead of overflowing', () => {
    const cyclic = { components: { schemas: {} } };
    cyclic.components.schemas.Node = {
      type: 'object',
      properties: {
        child: { $ref: '#/components/schemas/Node' },
      },
    };
    expect(() =>
      sampleSchema(cyclic, { $ref: '#/components/schemas/Node' })
    ).not.toThrow();
  });
});

describe('findSchemaFixture', () => {
  const spec = {
    paths: {
      '/api/v1/mentors/{user_id}/{language}/profile': {
        get: {
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { user_id: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  it('matches a templated path with the /api prefix stripped', () => {
    const fixture = findSchemaFixture(
      spec,
      'GET',
      '/v1/mentors/9001/zh_TW/profile'
    );
    expect(fixture).toEqual({ status: 200, body: { user_id: 0 } });
  });

  it('is case-insensitive on the HTTP method', () => {
    expect(
      findSchemaFixture(spec, 'get', '/v1/mentors/9001/zh_TW/profile')
    ).not.toBeNull();
  });

  it('returns null when no path template matches', () => {
    expect(
      findSchemaFixture(spec, 'GET', '/v1/totally/unknown/path')
    ).toBeNull();
  });

  it('returns null when the path matches but the method does not', () => {
    expect(
      findSchemaFixture(spec, 'POST', '/v1/mentors/9001/zh_TW/profile')
    ).toBeNull();
  });

  it('returns null when the operation has no 2xx response schema', () => {
    const noSchemaSpec = {
      paths: { '/api/v1/ping': { get: { responses: { 204: {} } } } },
    };
    expect(findSchemaFixture(noSchemaSpec, 'GET', '/v1/ping')).toBeNull();
  });
});

describe('getSchemaMockFixture (real committed OpenAPI snapshot)', () => {
  it('finds a baseline fixture for the mentor profile endpoint', () => {
    const fixture = getSchemaMockFixture(
      'GET',
      '/v1/mentors/9001/zh_TW/profile'
    );
    expect(fixture?.status).toBe(200);
    expect(fixture?.body).toEqual(
      expect.objectContaining({ data: expect.anything() })
    );
  });

  it('finds a baseline fixture for the tags catalog endpoint', () => {
    const fixture = getSchemaMockFixture('GET', '/v1/users/zh_TW/tags/catalog');
    expect(fixture?.status).toBe(200);
    expect(fixture?.body).toEqual(
      expect.objectContaining({ data: expect.anything() })
    );
  });

  it('returns null for a path the contract does not define', () => {
    expect(getSchemaMockFixture('GET', '/v1/nonexistent')).toBeNull();
  });
});
