#!/bin/bash

if git diff --exit-code --name-only data.json; then
  echo "data.json unchanged, not deploying"
  exit 0
else
  echo "data.json changed"
fi

npm version patch
npm publish
