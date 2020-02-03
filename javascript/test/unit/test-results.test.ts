import * as assert from 'assert';
import {
    testResults
} from '../../src/logic-generator/test-results';
import {
    findAllQuery, getQueryVariations
} from '../../src/logic-generator/queries';
import { minimongoFind } from '../../src/logic-generator/minimongo-helper';
import { getReuseableChangeEvents } from '../../src/logic-generator/data-generator';
describe('test-results.test.ts', () => {
    it('should always be correct on empty state-action-map', async () => {
        const useChangeEvents = await getReuseableChangeEvents(100);
        const res = await testResults(
            [
                getQueryVariations()[0],
                getQueryVariations()[1],
                getQueryVariations()[2]
            ],
            new Map(),
            useChangeEvents
        );
        assert.ok(res.correct);
        const allDocs = await minimongoFind(res.collection, findAllQuery);
        assert.ok(allDocs.length > 3);
    });
    it('should always be non-correct in an hacked state-action-map', async () => {
        const useChangeEvents = await getReuseableChangeEvents(100);
        const hackedMap = new Map();
        hackedMap.get = () => 'doNothing';

        const res = await testResults(
            [
                getQueryVariations()[0],
                getQueryVariations()[1],
                getQueryVariations()[2]
            ],
            hackedMap,
            useChangeEvents
        );
        assert.ok(!res.correct);
    });
});