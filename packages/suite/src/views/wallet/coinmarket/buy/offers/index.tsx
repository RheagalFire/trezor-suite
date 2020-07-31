import React from 'react';
import styled from 'styled-components';
import { LayoutContext } from '@suite-components';
import { variables, Quote, H2 } from '@trezor/components';
import { useSelector } from '@suite/hooks/suite';

const Wrapper = styled.div`
    padding: 16px 32px 32px 32px;

    @media screen and (max-width: ${variables.SCREEN_SIZE.LG}) {
        padding: 16px;
    }
`;

const Quotes = styled.div``;

const Offers = () => {
    const { setLayout } = React.useContext(LayoutContext);

    React.useMemo(() => {
        if (setLayout) setLayout(undefined, undefined);
    }, [setLayout]);

    const quotes = useSelector(state => state.wallet.coinmarket.quotes);

    return (
        <Wrapper data-test="@quotes/index">
            <H2>Offers:</H2>
            <Quotes>
                {quotes.map(quote => (
                    <Quote
                        key={`${quote.exchange}-${quote.paymentMethod}-${quote.receiveCurrency}`}
                        exchange={quote.exchange}
                        receiveStringAmount={quote.receiveStringAmount}
                        receiveCurrency={quote.receiveCurrency}
                        paymentMethod={quote.paymentMethod}
                    />
                ))}
            </Quotes>
        </Wrapper>
    );
};

export default Offers;
