import{test}from'node:test';import assert from'node:assert/strict';
import{ScoreWriteError,scoreFailureCode}from'../server/src/cloud.ts';
test('Classement : diagnostic limité à une catégorie, jamais au texte contenant une clé ou une URL',()=>{
 assert.equal(scoreFailureCode(new ScoreWriteError(401)),'HTTP_401');assert.equal(scoreFailureCode(new TypeError('Cannot convert key to ByteString')),'INVALID_SERVER_KEY_FORMAT');assert.equal(scoreFailureCode(new TypeError('fetch failed')),'UPSTREAM_NETWORK');assert.equal(scoreFailureCode(new DOMException('timeout','TimeoutError')),'UPSTREAM_TIMEOUT');assert.equal(scoreFailureCode(new Error('CAUCHEMAR_MIGRATION_REQUIRED')),'DATABASE_MIGRATION');assert.equal(scoreFailureCode(new Error('secret URL or provider response')),'SCORE_WRITE_FAILED');
});
