import React, { useState, useEffect } from 'react';
import { Button, Dropdown } from '@trezor/components';
import styled from 'styled-components';
import { useActions, useSelector } from '@suite-hooks';
import * as metadataActions from '@suite-actions/metadataActions';
import { MetadataAddPayload } from '@suite-types/metadata';

import MetadataEdit from './Edit';

const LabelDefaultValue = styled.div`
    min-width: 0;
    max-width: 0;
    transition: all 1s;
    text-overflow: ellipsis;

    &::before {
        content: ':';
    }
`;

const AddLabelButton = styled(Button)`
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.4s;
`;

const LabelValue = styled.div``;

const Label = styled.div`
    cursor: pointer;
    display: flex;
    overflow: hidden;
`;

const LabelContainer = styled.div`
    display: flex;
    white-space: nowrap;
    &:hover {
        ${AddLabelButton} {
            visibility: visible;
            opacity: 1;
        }
        ${LabelDefaultValue} {
            max-width: 440px;
        }
    }
`;

interface DropdownMenuItem {
    key: string;
    label: React.ReactNode;
    callback?: () => boolean | void;
    'data-test'?: string;
}

interface Props {
    defaultVisibleValue?: React.ReactNode;
    dropdownOptions?: DropdownMenuItem[];
    payload: MetadataAddPayload;
}

/**
 * Component displaying "Add label button"
 */
const MetadataButton = (props: Props) => {
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    const metadata = useSelector(state => state.metadata);
    const deviceState = useSelector(state => state.suite.device?.state);
    const deviceMetadata = useSelector(state => state.suite.device?.metadata);
    // I see that I may use getDiscovery or getDiscoveryForDevice actions but is that correct? In component, I should subscribe
    // to store, not call an action on its occasional re-render which may reflect real state in the and but...
    const discovery = useSelector(state => state.wallet.discovery);

    const { addMetadata, initMetadata } = useActions({
        addMetadata: metadataActions.addMetadata,
        initMetadata: metadataActions.init,
    });

    const discoveryFinished = discovery.find(d => d.deviceState === deviceState)?.status === 4;

    useEffect(() => {
        if (
            editing &&
            !loading &&
            (!metadata.enabled || deviceMetadata?.status !== 'enabled' || !metadata.provider)
        ) {
            /** when clicking on inline input edit, ensure that everything needed is already ready */
            const init = async () => {
                setLoading(true);
                const result = await initMetadata(true);
                if (!result) setEditing(false);
                setLoading(false);
            };
            init();
        }
    }, [metadata, deviceMetadata, editing, loading, initMetadata]);

    const onSubmit = (value: string | undefined | null) => {
        addMetadata({
            ...props.payload,
            value: value || undefined,
        });
    };

    let dropdownItems: DropdownMenuItem[] = [
        {
            callback: () => setEditing(true),
            label: 'Edit label',
            'data-test': '@metadata/edit-button',
            key: 'edit-label',
        },
        {
            callback: () => onSubmit(''),
            label: 'Remove label',
            'data-test': '@metadata/remove-button',
            key: 'remove-label',
        },
    ];

    if (props.dropdownOptions) {
        dropdownItems = [...dropdownItems, ...props.dropdownOptions];
    }

    const dataTestBase = `@metadata/${props.payload.type}/${props.payload.defaultValue}`;

    if (loading) return <span>loading...</span>;

    if (editing && !loading && metadata.enabled && deviceMetadata?.status === 'enabled') {
        return (
            <MetadataEdit
                originalValue={props.payload.value}
                onSubmit={onSubmit}
                onBlur={() => {
                    setEditing(false);
                }}
            />
        );
    }

    return (
        <LabelContainer>
            {props.payload.value ? (
                <Dropdown alignMenu="left" items={[{ options: dropdownItems, key: 'dropdown' }]}>
                    <Label data-test={dataTestBase}>
                        <LabelValue>{props.payload.value}</LabelValue>
                        {props.defaultVisibleValue && (
                            <LabelDefaultValue>{props.defaultVisibleValue}</LabelDefaultValue>
                        )}
                    </Label>
                </Dropdown>
            ) : (
                props.defaultVisibleValue
            )}

            {!props.payload.value && (
                <AddLabelButton
                    data-test={`${dataTestBase}/add-label-button`}
                    variant="tertiary"
                    icon={discoveryFinished ? 'LABEL' : undefined}
                    isLoading={!discoveryFinished}
                    isDisabled={!discoveryFinished}
                    onClick={e => {
                        e.stopPropagation();
                        setEditing(true);
                    }}
                >
                    {discoveryFinished ? 'Add label' : 'Loading...'}
                </AddLabelButton>
            )}
        </LabelContainer>
    );
};

export default MetadataButton;