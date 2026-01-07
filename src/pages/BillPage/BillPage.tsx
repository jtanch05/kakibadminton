import { useState, useEffect, useCallback } from 'react';
import { Section, Cell, Input, Button, List } from '@telegram-apps/telegram-ui';

import { Page } from '@/components/Page.tsx';
import { ShuttleCalculator } from '@/components/ShuttleCalculator.tsx';
import styles from './BillPage.module.css';

export const BillPage = () => {
    const [courtFee, setCourtFee] = useState<string>('');
    const [shuttleCost, setShuttleCost] = useState<number>(0);
    const [playerCount, setPlayerCount] = useState<number>(4);
    const [sessionId, setSessionId] = useState<number | null>(null);

    const totalCost = (parseFloat(courtFee) || 0) + shuttleCost;
    const perPerson = playerCount > 0 ? totalCost / playerCount : 0;

    const handleSettle = useCallback(() => {
        const data = JSON.stringify({
            type: 'settle',
            sessionId: sessionId,
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
    }, [sessionId, courtFee, shuttleCost, playerCount, totalCost, perPerson]);

    // Expand web app and read session data
    useEffect(() => {
        // @ts-ignore
        window.Telegram?.WebApp?.expand();

        // Read session ID from URL
        const params = new URLSearchParams(window.location.search);
        const session = params.get('session');

        if (session) {
            const sid = parseInt(session);
            setSessionId(sid);

            // Try to get session data from initData
            // @ts-ignore
            const initData = window.Telegram?.WebApp?.initDataUnsafe;
            if (initData?.start_param) {
                try {
                    const sessionData = JSON.parse(atob(initData.start_param));
                    if (sessionData.playerCount) {
                        setPlayerCount(sessionData.playerCount);
                    }
                } catch (e) {
                    console.error('Failed to parse session data:', e);
                }
            }
        }
    }, []);

    return (
        <Page back={false}>
            <div className={styles.billPage}>
                {/* Total Cost Card */}
                <div className={styles.totalCard}>
                    <div className={styles.totalCardContent}>
                        <p className={styles.totalCardTitle}>
                            <span>🏸</span>
                            <span>Total Bill</span>
                        </p>
                        <h1 className={styles.totalCardAmount}>
                            RM{totalCost.toFixed(2)}
                        </h1>
                        <p className={styles.totalCardSubtitle}>
                            <span className={styles.totalCardPerPerson}>
                                RM{perPerson.toFixed(2)}
                            </span>
                            {' '}per person
                        </p>
                    </div>
                </div>

                <List>
                    <Section
                        header={
                            <span className={styles.sectionHeader}>
                                <span>🏟️</span>
                                <span>Court Fees</span>
                            </span>
                        }
                        className={styles.section}
                    >
                        <Input
                            header="RM"
                            placeholder="e.g. 50"
                            value={courtFee}
                            onChange={(e) => setCourtFee(e.target.value)}
                            type="number"
                        />
                    </Section>

                    <div className={styles.section}>
                        <ShuttleCalculator onCostChange={setShuttleCost} />
                    </div>

                    <Section header={`👥 Players`} className={styles.section}>
                        <Cell>
                            <div className={styles.counterContainer}>
                                <div className={styles.counterLabel}>
                                    <span>Number of Players</span>
                                </div>
                                <div className={styles.counterControls}>
                                    <Button
                                        mode="outline"
                                        size="s"
                                        onClick={() => setPlayerCount(Math.max(2, playerCount - 1))}
                                        disabled={playerCount === 2}
                                        className={styles.counterButton}
                                    >
                                        −
                                    </Button>
                                    <span className={styles.counterValue}>{playerCount}</span>
                                    <Button
                                        mode="outline"
                                        size="s"
                                        onClick={() => setPlayerCount(Math.min(20, playerCount + 1))}
                                        disabled={playerCount === 20}
                                        className={styles.counterButton}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>
                        </Cell>
                    </Section>

                    <Section
                        footer={
                            <span className={styles.footer}>
                                <span>💡</span>
                                <span>Click Settle to send the bill card to the group.</span>
                            </span>
                        }
                        className={styles.section}
                    >
                        <Cell>
                            <Button
                                mode="filled"
                                size="l"
                                stretched
                                onClick={handleSettle}
                                disabled={totalCost <= 0}
                                className={styles.settleButton}
                            >
                                🎯 Settle (RM{perPerson.toFixed(2)} / pax)
                            </Button>
                        </Cell>
                    </Section>
                </List>
            </div>
        </Page>
    );
};
