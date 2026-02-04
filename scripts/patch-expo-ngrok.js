#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const resolverPath = path.join(
  process.cwd(),
  'node_modules/expo/node_modules/@expo/cli/build/src/start/doctor/ngrok/NgrokResolver.js'
);
const asyncNgrokPath = path.join(
  process.cwd(),
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js'
);

function patchFile(filePath, patcher) {
  if (!fs.existsSync(filePath)) {
    console.log(`[expo-ngrok-patch] skip: not found ${path.relative(process.cwd(), filePath)}`);
    return false;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const next = patcher(source);

  if (next === source) {
    console.log(`[expo-ngrok-patch] ok: already patched ${path.basename(filePath)}`);
    return false;
  }

  fs.writeFileSync(filePath, next, 'utf8');
  console.log(`[expo-ngrok-patch] patched ${path.basename(filePath)}`);
  return true;
}

function patchNgrokResolver(source) {
  const original = `function isNgrokClientError(error) {\n    var _error_body;\n    return error == null ? void 0 : (_error_body = error.body) == null ? void 0 : _error_body.msg;\n}\n`;
  const patched = `function isNgrokClientError(error) {\n    return !!(error && typeof error === 'object' && error.body && typeof error.body === 'object' && 'msg' in error.body);\n}\n`;

  if (source.includes(patched)) {
    return source;
  }
  if (!source.includes(original)) {
    return source;
  }
  return source.replace(original, patched);
}

function patchAsyncNgrok(source) {
  const originalCatchBlock = `        } catch (error) {\n            const assertNgrok = ()=>{\n                if ((0, _NgrokResolver.isNgrokClientError)(error)) {\n                    var _error_body_details;\n                    throw new _errors.CommandError('NGROK_CONNECT', [\n                        error.body.msg,\n                        (_error_body_details = error.body.details) == null ? void 0 : _error_body_details.err,\n                        _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/')\n                    ].filter(Boolean).join('\\n\\n'));\n                }\n                throw new _errors.CommandError('NGROK_CONNECT', error.toString() + _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/'));\n            };\n`;
  const patchedCatchBlock = `        } catch (error) {\n            const errorBody = error && typeof error === 'object' && error.body && typeof error.body === 'object' ? error.body : null;\n            const assertNgrok = ()=>{\n                if ((0, _NgrokResolver.isNgrokClientError)(error) && errorBody) {\n                    const details = errorBody.details && typeof errorBody.details === 'object' ? errorBody.details : null;\n                    throw new _errors.CommandError('NGROK_CONNECT', [\n                        errorBody.msg,\n                        details == null ? void 0 : details.err,\n                        _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/')\n                    ].filter(Boolean).join('\\n\\n'));\n                }\n                throw new _errors.CommandError('NGROK_CONNECT', String(error) + _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/'));\n            };\n`;
  const originalRetryCondition = `            if ((0, _NgrokResolver.isNgrokClientError)(error) && error.body.error_code === 103) {`;
  const patchedRetryCondition = `            if ((0, _NgrokResolver.isNgrokClientError)(error) && (errorBody == null ? void 0 : errorBody.error_code) === 103) {`;

  let next = source;

  if (!next.includes('const errorBody = error && typeof error === \'object\'')) {
    next = next.replace(originalCatchBlock, patchedCatchBlock);
  }
  if (!next.includes(patchedRetryCondition)) {
    next = next.replace(originalRetryCondition, patchedRetryCondition);
  }

  return next;
}

const changed =
  patchFile(resolverPath, patchNgrokResolver) |
  patchFile(asyncNgrokPath, patchAsyncNgrok);

if (changed) {
  console.log('[expo-ngrok-patch] done');
}
