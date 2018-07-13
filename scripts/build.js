'use strict';
const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const is = require('sarcastic');

const OUTPUT_FILE_PATH = path.join(__dirname, '..', 'data.json');

// set this to `true` if you want to debug script
const DEBUG = process.env.DEBUG || false;

const SHAPE = is.shape({
  roles: is.objectOf(is.shape({
    ref: is.string,
    name: is.string,
    description: is.maybe(is.string),
    abstract: is.boolean,
    superClassRoles: is.arrayOf(is.string),
    attributes: is.arrayOf(is.string),
  })),
  valueTypes: is.objectOf(is.shape({
    ref: is.string,
    name: is.string,
    description: is.maybe(is.string),
  })),
  attributes: is.objectOf(is.shape({
    ref: is.string,
    name: is.string,
    description: is.maybe(is.string),
    valueType: is.string,
    values: is.maybe(is.arrayOf(is.shape({
      value: is.string,
      isDefault: is.boolean,
      description: is.maybe(is.string),
    }))),
  })),
});

let loggedTip = false;

async function main() {
  if (DEBUG) {
    console.log(chalk`{red.bold Running in debug mode...}`);
  }

  console.log(chalk`{dim [1/6]} {magenta Launching headless browser...}`);
  let browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  let page = await browser.newPage();

  // setup console forwarding:
  page.on('console', msg => {
    let type = msg.type();
    let text = msg.text();
    if (type === 'error') text = chalk.red(text);
    if (type === 'warning') text = chalk.yellow(text);
    if (type === 'info') text = chalk.cyan(text);
    if (!DEBUG && (type === 'warning' || type === 'info')) {
      if (!loggedTip) {
        console.log(chalk`{cyan.bold Tip: Set DEBUG=true to run in debug mode...}`);
        loggedTip = true
      }
      return;
    }
    console.log(text);
  });

  console.log(chalk`{dim [2/6]} {magenta Loading WAI ARIA 1.1 Spec...}`);
  await page.goto('https://www.w3.org/TR/wai-aria-1.1/');

  console.log(chalk`{dim [3/6]} {magenta Parsing data from spec...}`);
  let data = await page.evaluate(() => {
    let baseUrl = location.origin + location.pathname;
    let toRef = id => `${baseUrl}#${id}`;

    /**
     * ROLES
     */
    let roles = {};
    let $rolesMatches = Array.from(document.querySelectorAll('.role'));

    let $roles = new Map();
    for (let $el of $rolesMatches) {
      let ref = toRef($el.id);
      $roles.set(ref, $el);
      roles[ref] = { ref };
    }

    for (let [ref, $el] of $roles) {
      let $name = $el.querySelector('.role-name code');
      if (!$name) { throw new Error(`role.name could not be found for "${ref}"`); continue; }
      roles[ref].name = $name.textContent;
    }

    let $rolesDescriptions = Array.from(document.querySelectorAll(`#index_role dt a`));

    for (let [ref, $el] of $roles) {
      let $desc = $rolesDescriptions.find($desc => $desc.href === ref);
      if (!$desc) { console.warn(`role.description could not be found for "${ref}"`); }
      roles[ref].description = $desc ? $desc.parentElement.nextElementSibling.textContent : null;
    }

    for (let [ref, $el] of $roles) {
      let $abstract = $el.querySelector('.role-abstract');
      if (!$abstract) { console.warn(`role.abstract could not be found for "${ref}"`); }
      roles[ref].abstract = $abstract ? $abstract.textContent.includes('True') : false;
    }

    for (let [ref, $el] of $roles) {
      let $parents = Array.from($el.querySelectorAll('.role-parent .role-reference'));
      if (!$parents.length) { console.warn(`role.superClassRoles could not be found for "${ref}"`); }
      roles[ref].superClassRoles = $parents.map($parent => $parent.href);
    }

    for (let [ref, $el] of $roles) {
      let $attrs = Array.from($el.querySelectorAll('.role-properties .state-reference, .role-properties .property-reference'));
      if (!$attrs.length) { console.warn(`role.attributes could not be found for "${ref}"`); }
      roles[ref].attributes = $attrs.length ? $attrs.map($attr => $attr.href) : [];
    }

    /**
     * Synonyms
     */

    let noneRole = roles['https://www.w3.org/TR/wai-aria-1.1/#none'];
    let presentationRole = roles['https://www.w3.org/TR/wai-aria-1.1/#presentation'];
    if (noneRole && presentationRole) noneRole.superClassRoles.push(presentationRole.ref);

    /**
     * VALUE TYPES
     */
    let valueTypes = {};
    let $valueTypesMatches = Array.from(document.querySelectorAll('#propcharacteristic_value dt'));

    for (let $el of $valueTypesMatches) {
      let ref = toRef($el.id);
      let name = $el.textContent;
      let description = $el.nextElementSibling.textContent;
      valueTypes[ref] = { ref, name, description };
    }

    /**
     * ATTRIBUTES
     */
    let attributes = {};
    let $attrsMatches = Array.from(document.querySelectorAll('.property, .state'));

    let $attrs = new Map();
    for (let $el of $attrsMatches) {
      let ref = toRef($el.id);
      $attrs.set(ref, $el);
      attributes[ref] = { ref };
    }

    for (let [ref, $el] of $attrs) {
      let $name = $el.querySelector('.property-name code, .state-name code');
      if (!$name) { throw new Error(`attr.name could not be found for "${ref}"`); }
      attributes[ref].name = $name.textContent;
    }

    let $attrsDescriptions = Array.from(document.querySelectorAll(`#index_state_prop dt a`));

    for (let [ref, $el] of $attrs) {
      let $desc = $attrsDescriptions.find($desc => $desc.href === ref);
      if (!$desc) { console.warn(`attr.description could not be found for "${ref}"`); }
      attributes[ref].description = $desc ? $desc.parentElement.nextElementSibling.textContent : null;
    }

    for (let [ref, $el] of $attrs) {
      let $valueType = $el.querySelector('.property-value a, .state-value a');
      if (!$valueType) { throw new Error(`role.valueType could not be found for "${ref}"`); }
      attributes[ref].valueType = $valueType.href;
    }

    for (let [name, $el] of $attrs) {
      let $values = Array.from($el.querySelectorAll('.value-descriptions tbody tr'));
      if (!$values.length) { console.warn(`attr.values could not be found for "${name}"`); continue; }
      attributes[name].values = $values.map($value => {
        let value = $value.querySelector('.value-name').textContent;
        return {
          value: value.replace(/ \(default\)$/, ''),
          isDefault: value.includes('(default)'),
          description: $value.querySelector('.value-description').textContent,
        };
      });
    }

    return { roles, valueTypes, attributes };
  });

  console.log(chalk`{dim [4/6]} {magenta Closing browser...}`);
  await browser.close();

  console.log(chalk`{dim [5/6]} {magenta Validating data...}`);
  is(data, SHAPE, 'data');

  console.log(chalk`{dim [6/6]} {magenta Updating data.json...}`);
  await writeFile(OUTPUT_FILE_PATH, JSON.stringify(data, null, 2));

  console.log(chalk`{green.bold Success!}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
