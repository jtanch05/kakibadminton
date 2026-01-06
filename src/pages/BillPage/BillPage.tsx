import { useState, useEffect, useCallback } from 'react';
import { Section, Cell, Input, Button, List, Slider } from '@telegram-apps/telegram-ui';

import { Page } from '@/components/Page.tsx';
import { ShuttleCalculator } from '@/components/ShuttleCalculator.tsx';

export const BillPage = () => {
    const [courtFee, setCourtFee] = useState<string>('');
    const [shuttleCost, setShuttleCost] = useState<number>(0);
    const [playerCount, setPlayerCount] = useState<number>(4);

    const totalCost = (parseFloat(courtFee) || 0) + shuttleCost;
    const perPerson = playerCount > 0 ? totalCost / playerCount : 0;

    const handleSettle = useCallback(() => {
        const data = JSON.stringify({
            type: 'settle',
            court: parseFloat(courtFee) || 0,
            shuttles: shuttleCost,
            players: playerCount,
            total: totalCost,
            perPerson: perPerson
        });

        // @ts-ignore
        if (window.Telegram?.WebApp) {
            // @ts-ignore
            window.Telegram.WebApp.sendData(data);
        }
    }, [courtFee, shuttleCost, playerCount, totalCost, perPerson]);

    // Expand web app
    useEffect(() => {
        // @ts-ignore
        window.Telegram?.WebApp?.expand();
    }, []);

    return (
        <Page back={false}>
            <List>
                <Section header="Court Fees">
                    <Input
                        header="RM"
                        placeholder="e.g. 50"
                        value={courtFee}
                        onChange={(e) => setCourtFee(e.target.value)}
                        type="number"
                    />
                </Section>

                <ShuttleCalculator onCostChange={setShuttleCost} />

                <Section header={`Players: ${playerCount}`}>
                    <Cell>
                        <Slider
                            value={playerCount}
                            min={2}
                            max={20}
                            step={1}
                            onChange={setPlayerCount}
                        />
                    </Cell>
                </Section>

                <Section footer="Click Settle to send the bill card to the group.">
                    <Cell>
                        <Button
                            mode="filled"
                            size="l"
                            stretched
                            onClick={handleSettle}
                            disabled={totalCost <= 0}
                        >
                            Settle (RM{perPerson.toFixed(2)} / pax)
                        </Button>
                    </Cell>
                </Section>
            </List>
        </Page>
    );
};
