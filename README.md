# aria-data

> Raw JSON data for [WAI-ARIA 1.1](https://www.w3.org/TR/wai-aria-1.1/) roles, attributes (states & properties), and value types

## Install

```sh
yarn add aria-data
```

## Usage

```js
const ariaData = require('aria-data');
// {
//   roles: {...},
//   valueTypes: {...},
//   attributes: {...}
// }
```

## Guide

### References

This dataset uses URLs such as `https://www.w3.org/TR/wai-aria-1.1/#alert` as
reference IDs for entities. For example:

```json
{
  "ref": "https://www.w3.org/TR/wai-aria-1.1/#aria-activedescendant",
  "name": "aria-activedescendant",
  "description": "Identifies the currently active element (...)",
  "valueType": "https://www.w3.org/TR/wai-aria-1.1/#valuetype_idref"
}
```

### Interface

This dataset has the following interface:

```ts
export default interface {
  roles: {
    [ref: string]: {
      ref: string,
      name: string,
      description?: string,
      abstract: boolean,
      superClassRoles: Array<Ref>,
      attributes: Array<Ref>,
    },
  },
  valueTypes: {
    [ref: string]: {
      ref: string,
      name: string,
      description?: string,
    },
  },
  attributes: {
    [ref: string]: {
      ref: string,
      name: string,
      description?: string,
      valueType: Ref,
      values?: Array<{
        value: string,
        isDefault: boolean,
        description?: string,
      }>
    },
  },
}
```

## Example

```js
const { roles, valueTypes, attributes } = require('aria-data');
const ROLES_ARR = Object.keys(roles).map(ref => roles[ref]);

function findRole(roleName) {
  return ROLES_ARR.find(role => role.name === roleName);
}

function getAttrs(role) {
  function traverse(role) {
    return role.superClassRoles.reduce((attrs, ref) => {
      return attrs.concat(traverse(roles[ref]));
    }, role.attributes);
  }

  return traverse(role).map(ref => attributes[ref].name);
}

let alert = findRole('alert');
let alertAttrs = getAttrs(alert);
// ['aria-expanded', 'aria-atomic', 'aria-busy', 'aria-controls', ...]
// ['aria-atomic', 'aria-busy', ...]
```

test3
