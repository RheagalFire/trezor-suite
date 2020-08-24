import { db } from '@suite/storage';
import SuiteDB from '@trezor/suite-storage';
import { STORAGE } from './constants';
import { Dispatch, GetState, AppState, TrezorDevice } from '@suite-types';
import { Account } from '@wallet-types';
import { GraphData } from '@wallet-types/graph';
import { getAccountKey } from '@wallet-utils/accountUtils';
import { Discovery } from '@wallet-reducers/discoveryReducer';
import * as notificationActions from '@suite-actions/notificationActions';
import * as suiteActions from '@suite-actions/suiteActions';
import { serializeDiscovery, serializeDevice } from '@suite-utils/storage';
import { deviceGraphDataFilterFn } from '@wallet-utils/graphUtils';
import { FormState } from '@wallet-types/sendForm';
import { getAnalyticsRandomId } from '@suite-utils/random';
import { setSentryUser } from '@suite-utils/sentry';

export type StorageActions =
    | { type: typeof STORAGE.LOAD }
    | { type: typeof STORAGE.LOADED; payload: AppState }
    | { type: typeof STORAGE.ERROR; error: any };

// send form drafts start

export const saveDraft = (formState: FormState, accountKey: string) => {
    return db.addItem('sendFormDrafts', formState, accountKey);
};

export const removeDraft = (accountKey: string) => {
    return db.removeItemByPK('sendFormDrafts', accountKey);
};

export const saveAccountDraft = (account: Account) => async (_: Dispatch, getState: GetState) => {
    const { drafts } = getState().wallet.send;
    const accountKey = getAccountKey(account.descriptor, account.symbol, account.deviceState);
    const draft = drafts[accountKey];
    if (draft) {
        return db.addItem('sendFormDrafts', draft, accountKey);
    }
};

export const removeAccountDraft = (account: Account) => {
    const accountKey = getAccountKey(account.descriptor, account.symbol, account.deviceState);
    return db.removeItemByPK('sendFormDrafts', accountKey);
};

// send form drafts end

export const saveDevice = async (device: TrezorDevice) => {
    if (!device || !device.features || !device.state) return;
    return db.addItem('devices', serializeDevice(device), device.state);
};

export const removeAccount = async (account: Account) => {
    return db.removeItemByPK('accounts', [account.descriptor, account.symbol, account.deviceState]);
};

export const removeAccountTransactions = async (account: Account) => {
    await db.removeItemByIndex('txs', 'accountKey', [
        account.descriptor,
        account.symbol,
        account.deviceState,
    ]);
};

export const forgetDevice = (device: TrezorDevice) => async (_: Dispatch, getState: GetState) => {
    if (!device.state) return;
    const accounts = getState().wallet.accounts.filter(a => a.deviceState === device.state);
    const accountPromises = accounts.reduce((promises, account) => {
        return promises.concat([removeAccountDraft(account)]);
    }, [] as Promise<any>[]);
    const promises = await Promise.all([
        db.removeItemByPK('devices', device.state),
        db.removeItemByIndex('accounts', 'deviceState', device.state),
        db.removeItemByPK('discovery', device.state),
        db.removeItemByIndex('txs', 'deviceState', device.state),
        db.removeItemByIndex('graph', 'deviceState', device.state),
        ...accountPromises,
    ]);
    return promises;
};

export const saveAccounts = async (accounts: Account[]) => {
    return db.addItems('accounts', accounts, true);
};

export const saveDiscovery = async (discoveries: Discovery[]) => {
    return db.addItems('discovery', discoveries, true);
};

export const saveGraph = async (graphData: GraphData[]) => {
    return db.addItems('graph', graphData, true);
};

export const saveAccountTransactions = (account: Account) => async (
    _dispatch: Dispatch,
    getState: GetState,
) => {
    const allTxs = getState().wallet.transactions.transactions;
    const accTxs =
        allTxs[getAccountKey(account.descriptor, account.symbol, account.deviceState)] || [];

    // wrap confirmed txs and add its order inside the array
    const orderedTxs = accTxs
        .filter(t => (t.blockHeight || 0) > 0)
        .map((accTx, i) => ({
            tx: accTx,
            order: i,
        }));
    return db.addItems('txs', orderedTxs, true);
};

export const removeAccountGraph = async (account: Account) => {
    return db.removeItemByIndex('graph', 'accountKey', [
        account.descriptor,
        account.symbol,
        account.deviceState,
    ]);
};

export const rememberDevice = (device: TrezorDevice, remember: boolean) => async (
    dispatch: Dispatch,
    getState: GetState,
) => {
    if (!device || !device.features || !device.state) return;
    if (!remember) {
        return dispatch(forgetDevice(device));
    }

    const { wallet } = getState();
    const accounts = wallet.accounts.filter(a => a.deviceState === device.state);
    const graphData = wallet.graph.data.filter(d => deviceGraphDataFilterFn(d, device.state));
    const discovery = wallet.discovery
        .filter(d => d.deviceState === device.state)
        .map(serializeDiscovery);

    const accountPromises = accounts.reduce((promises, account) => {
        return promises.concat([
            dispatch(saveAccountTransactions(account)),
            dispatch(saveAccountDraft(account)),
        ]);
    }, [] as Promise<any>[]);

    try {
        await Promise.all([
            saveDevice(device),
            saveAccounts(accounts),
            saveGraph(graphData),
            saveDiscovery(discovery),
            ...accountPromises,
        ] as Promise<void | string | undefined>[]);
    } catch (error) {
        console.error('Remember device:', error);
    }
};

export const saveWalletSettings = () => async (_dispatch: Dispatch, getState: GetState) => {
    await db.addItem(
        'walletSettings',
        {
            ...getState().wallet.settings,
        },
        'wallet',
    );
};

export const removeFiatRate = (symbol: string) => (_dispatch: Dispatch, _getState: GetState) => {
    // TODO: just to be safe store and delete by compound index [symbol, mainNetworkSymbol]
    // check if it's fine to have mainNetworkSymbol undefined
    return db.removeItemByPK('fiatRates', symbol);
};

export const saveFiatRates = () => (_dispatch: Dispatch, getState: GetState) => {
    return db.addItems('fiatRates', getState().wallet.fiat.coins, true);
};

export const saveSuiteSettings = () => (_dispatch: Dispatch, getState: GetState) => {
    const { suite } = getState();
    db.addItem(
        'suiteSettings',
        {
            settings: suite.settings,
            flags: {
                initialRun: suite.flags.initialRun,
                // is not saved at the moment, but probably will be in future. now we always
                // initialWebRun: suite.flag.initialWebRun,
                discreetModeCompleted: suite.flags.discreetModeCompleted,
            },
        },
        'suite',
    );
};

export const saveAnalytics = () => (_dispatch: Dispatch, getState: GetState) => {
    const { analytics } = getState();
    db.addItem(
        'analytics',
        {
            enabled: analytics.enabled,
            instanceId: analytics.instanceId,
        },
        'suite',
    );
};

export const clearStores = () => async (dispatch: Dispatch, getState: GetState) => {
    const rememberedDevices = getState().devices.filter(d => d.remember);
    // forget all remembered devices
    rememberedDevices.forEach(d => {
        suiteActions.rememberDevice(d);
    });
    await db.clearStores();
    dispatch(
        notificationActions.addToast({
            type: 'clear-storage',
        }),
    );
};

export const loadStorage = () => async (dispatch: Dispatch, getState: GetState) => {
    const isDBAvailable = await SuiteDB.isDBAvailable();

    if (!isDBAvailable) {
        // console.warn('IndexedDB not supported');
        const initialState = getState();
        dispatch({
            type: STORAGE.LOADED,
            payload: {
                ...initialState,
            },
        });
    } else {
        //  load state from database
        const suite = await db.getItemByPK('suiteSettings', 'suite');
        const devices = await db.getItemsExtended('devices');
        const accounts = await db.getItemsExtended('accounts');
        const discovery = await db.getItemsExtended('discovery');
        const walletSettings = await db.getItemByPK('walletSettings', 'wallet');
        const fiatRates = await db.getItemsExtended('fiatRates');
        const walletGraphData = await db.getItemsExtended('graph');
        const analytics = await db.getItemByPK('analytics', 'suite');

        const txs = await db.getItemsExtended('txs', 'order');
        const mappedTxs: AppState['wallet']['transactions']['transactions'] = {};
        txs.forEach(item => {
            const k = getAccountKey(item.tx.descriptor, item.tx.symbol, item.tx.deviceState);
            if (!mappedTxs[k]) {
                mappedTxs[k] = [];
            }
            mappedTxs[k][item.order] = item.tx;
        });

        const initialState = getState();

        if (analytics?.instanceId) {
            setSentryUser(analytics.instanceId);
        }

        const sendForm = await db.getItemsWithKeys('sendFormDrafts');
        const drafts: AppState['wallet']['send']['drafts'] = {};
        sendForm.forEach(item => {
            drafts[item.key] = item.value;
        });

        dispatch({
            type: STORAGE.LOADED,
            payload: {
                ...initialState,
                suite: {
                    ...initialState.suite,
                    ...suite,
                    flags: {
                        ...initialState.suite.flags,
                        ...suite?.flags,
                    },
                    settings: {
                        ...initialState.suite.settings,
                        ...suite?.settings,
                    },
                },
                devices,
                wallet: {
                    ...initialState.wallet,
                    settings: {
                        ...initialState.wallet.settings,
                        ...walletSettings,
                    },
                    accounts,
                    discovery,
                    transactions: {
                        ...initialState.wallet.transactions,
                        transactions: mappedTxs,
                    },
                    fiat: { ...initialState.wallet.fiat, coins: fiatRates || [] },
                    graph: {
                        ...initialState.wallet.graph,
                        data: walletGraphData || [],
                    },
                    send: {
                        ...initialState.wallet.send,
                        drafts,
                    },
                },
                analytics: analytics?.instanceId
                    ? { ...analytics, sessionId: getAnalyticsRandomId() }
                    : initialState.analytics,
            },
        });
    }
};
