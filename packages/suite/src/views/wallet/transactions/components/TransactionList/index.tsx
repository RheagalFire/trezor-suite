/* eslint-disable radix */
import React, { useMemo } from 'react';
import { FormattedDate } from 'react-intl';
import { Translation } from '@suite-components/Translation';
import styled from 'styled-components';
import { H5, P, colors, variables } from '@trezor/components';
import { WalletAccountTransaction } from '@wallet-reducers/transactionReducer';
import { groupTransactionsByDate, parseKey } from '@wallet-utils/transactionUtils';
import { SETTINGS } from '@suite-config';
import TransactionItem from '../TransactionItem';
import Pagination from '../Pagination';
import messages from '@suite/support/messages';

const Wrapper = styled.div``;

const Transactions = styled.div``;

const StyledH5 = styled(H5)`
    font-size: 1em;
    color: ${colors.TEXT_SECONDARY};
    font-weight: ${variables.FONT_WEIGHT.MEDIUM};
    padding-top: 20px;
    margin: 0 -35px;
    padding-left: 35px;
    padding-right: 35px;
    background: ${colors.LANDING};
    border-top: 1px solid ${colors.INPUT_BORDER};
`;

interface Props {
    explorerUrl?: string;
    transactions: WalletAccountTransaction[];
    currentPage: number;
    totalPages?: number;
    perPage: number;
    onPageSelected: (page: number) => void;
}

const TransactionList = ({
    explorerUrl,
    transactions,
    currentPage,
    totalPages,
    onPageSelected,
    perPage,
}: Props) => {
    const startIndex = (currentPage - 1) * perPage;
    const stopIndex = startIndex + perPage;

    const slicedTransactions = useMemo(() => transactions.slice(startIndex, stopIndex), [
        transactions,
        startIndex,
        stopIndex,
    ]);

    const transactionsByDate = useMemo(() => groupTransactionsByDate(slicedTransactions), [
        slicedTransactions,
    ]);

    // if totalPages is 1 do not render pagination
    // if totalPages is undefined check current page and number of txs (e.g. XRP)
    // Edge case: if there is exactly 25 txs, pagination will be displayed
    const isOnLastPage = slicedTransactions.length < SETTINGS.TXS_PER_PAGE;
    const showPagination = totalPages ? totalPages > 1 : currentPage === 1 && !isOnLastPage;

    return (
        <Wrapper>
            <Transactions>
                {Object.keys(transactionsByDate).map(dateKey => (
                    <React.Fragment key={dateKey}>
                        <StyledH5>
                            {dateKey === 'pending' ? (
                                <P>
                                    <Translation {...messages.TR_PENDING} />
                                </P>
                            ) : (
                                <FormattedDate
                                    value={parseKey(dateKey)}
                                    day="numeric"
                                    month="long"
                                    year="numeric"
                                />
                            )}
                        </StyledH5>
                        {transactionsByDate[dateKey].map((tx: WalletAccountTransaction) => (
                            <TransactionItem
                                key={tx.txid}
                                {...tx}
                                explorerUrl={`${explorerUrl}${tx.txid}`}
                            />
                        ))}
                    </React.Fragment>
                ))}
            </Transactions>
            {showPagination && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    isOnLastPage={isOnLastPage}
                    onPageSelected={onPageSelected}
                />
            )}
        </Wrapper>
    );
};

export default TransactionList;