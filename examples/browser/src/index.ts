import {
    setQuery,
    setResults,
    $test100EventsButton,
    $test100EventsEventReduceButton,
    $techSelectionSelect,
    setButtonsDisableState,
    setLoadingState,
    setExampleQueries,
    $queryTextArea,
    $invalidQuery
} from './dom';

import {
    MiniMongoImplementation
} from './minimongo';
import {
    NeDbImplementation
} from './nedb';

import {
    getInitialData,
    getRandomChangeEvents
} from './data-generator';
import { Human, IdToDocumentMap, DatabaseImplementation, Query } from './types';
import { idToDocMapFromList, removeOptions, getParameterByName } from './util';
import { ChangeEvent, calculateActionName, StateResolveFunctionInput, runAction } from 'event-reduce-js';
import { performanceNow } from 'async-test-util';

import '../style.less';
import { PouchDbImplementation } from './pouchdb';
import { appendToLog } from './logs';

async function run() {
    const implementations: DatabaseImplementation[] = [
        new MiniMongoImplementation(),
        new PouchDbImplementation(),
        new NeDbImplementation()
    ];

    // init selects
    implementations.forEach(imp => {
        const name = imp.getName();
        imp.getStorageOptions().forEach(option => {
            const optionDiv = document.createElement('option');
            optionDiv.text = name + ': ' + option;
            optionDiv.value = name + ':' + option;
            $techSelectionSelect.add(optionDiv);
        });
    });
    const techParam = getParameterByName('tech');
    if (techParam) {
        $techSelectionSelect.value = techParam;
    }
    $techSelectionSelect.onchange = () => {
        console.log('selectred');
        const newValue = $techSelectionSelect.value;
        const newUrl = location.origin + location.pathname + '?tech=' + newValue;
        window.location.href = newUrl;
    };


    const techValue = $techSelectionSelect.value;
    console.log('techValue: ' + techValue);
    const split = techValue.split(':');
    const implementation: DatabaseImplementation = implementations.find(imp => imp.getName() === split[0]);
    const storage = split[1];

    await implementation.init(storage);

    // add initial data
    const initialData: ChangeEvent<Human>[] = getInitialData(100);
    await Promise.all(initialData.map(cE => implementation.handleEvent(cE)));


    // init inintial query
    let query = implementation.getExampleQueries()[0];
    setQuery(query);
    let currentResults: Human[] = await implementation.getRawResults(query);
    let currentDocMap: IdToDocumentMap = idToDocMapFromList(currentResults);
    setResults(currentResults);

    // update results on query change
    $queryTextArea.onkeyup = async () => {
        console.log('$queryTextArea.onkeyup()');
        const newValue = ($queryTextArea as any).value;
        try {
            query = JSON.parse(newValue);
            currentResults = await implementation.getRawResults(query);
            setResults(currentResults);
            $invalidQuery.style.display = 'none';
        } catch (err) {
            console.dir(newValue);
            console.dir(err);
            $invalidQuery.style.display = 'block';
        }
    };

    // add query example buttons
    setExampleQueries(
        implementation.getExampleQueries(),
        async (clickedQuery: Query) => {
            $invalidQuery.style.display = 'none';
            currentResults = await implementation.getRawResults(clickedQuery);
            setResults(currentResults);
        }
    );

    // without event-reduce
    $test100EventsButton.onclick = async () => {
        setButtonsDisableState(true);
        setLoadingState('Run without EventReduce..');

        const prevData = await implementation.getAll();
        const events = await getRandomChangeEvents(
            prevData,
            100
        );

        let totalWriteTime = 0;
        const timeStart = performanceNow();
        for (const changeEvent of events) {
            const writeTime = await implementation.handleEvent(changeEvent);
            totalWriteTime = totalWriteTime + writeTime;
            currentResults = await implementation.getRawResults(query);
            setResults(currentResults);
        }
        currentDocMap = idToDocMapFromList(currentResults);

        const timeEnd = performanceNow();
        const totalTimeInMs = timeEnd - timeStart;
        const queryTime = totalTimeInMs - totalWriteTime;

        appendToLog('running 100 events without event reduce', {
            totalTimeInMs,
            totalWriteTime,
            queryTime
        });

        setButtonsDisableState(false);
        setLoadingState();
    };

    // with event-reduce
    $test100EventsEventReduceButton.onclick = async () => {
        setButtonsDisableState(true);
        setLoadingState('Run with EventReduce..');

        const prevData = await implementation.getAll();
        const events = await getRandomChangeEvents(
            prevData,
            100
        );
        const queryParams = implementation.getQueryParams(query);
        let optimizedEventsCount = 0;
        let totalWriteTime = 0;
        const timeStart = performanceNow();
        for (const changeEvent of events) {

            const writeTime = await implementation.handleEvent(changeEvent);
            totalWriteTime = totalWriteTime + writeTime;

            const input: StateResolveFunctionInput<Human> = {
                changeEvent,
                queryParams,
                previousResults: currentResults,
                keyDocumentMap: currentDocMap
            };
            const action = calculateActionName(input);
            if (action === 'runFullQueryAgain') {
                currentResults = await implementation.getRawResults(query);
                currentDocMap = idToDocMapFromList(currentResults);

                // console.dir(JSON.parse(JSON.stringify(input)));
            } else {
                optimizedEventsCount++;
                runAction(
                    action,
                    queryParams,
                    changeEvent,
                    currentResults,
                    currentDocMap
                );
            }
            setResults(currentResults);
        }


        const timeEnd = performanceNow();
        const totalTimeInMs = timeEnd - timeStart;

        const queryTime = totalTimeInMs - totalWriteTime;
        appendToLog('running 100 events with event-reduce', {
            totalTimeInMs,
            totalWriteTime,
            optimizedEventsCount,
            queryTime
        });

        setButtonsDisableState(false);
        setLoadingState();
    };

    setLoadingState();
}

run();
