'use strict';
const test = require('ava');
const { roles, valueTypes, attributes } = require('./');

test('example usage', t => {
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

  t.true(Array.isArray(alertAttrs));
});
