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
    const [isHost, setIsHost] = useState<boolean>(true);
    const [hostName, setHostName] = useState<string>('');

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
        const hostId = params.get('hostId');
        const hostNameParam = params.get('hostName');

        // @ts-ignore
        const initData = window.Telegram?.WebApp?.initDataUnsafe;
        const currentUserId = initData?.user?.id;

        if (session) {
            const sid = parseInt(session);
            setSessionId(sid);

            // Check if current user is the host
            if (hostId && currentUserId) {
                const isUserHost = parseInt(hostId) === currentUserId;
                setIsHost(isUserHost);
                if (hostNameParam) {
                    setHostName(decodeURIComponent(hostNameParam));
                }
            }

            // Try to get session data from initData
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
                        <label htmlFor="court-fee" className="sr-only">
                            Court rental fee in Malaysian Ringgit
                        </label>
                        <Input
                            id="court-fee"
                            header="RM"
                            placeholder="e.g. 50"
                            value={courtFee}
                            onChange={(e) => setCourtFee(e.target.value)}
                            type="number"
                            inputMode="decimal"
                            aria-label="Court rental fee in Malaysian Ringgit"
                            aria-describedby="court-fee-help"
                        />
                        <span id="court-fee-help" className="sr-only">
                            Enter the total court rental fee for this session
                        </span>
                    </Section>

                    <div className={styles.section}>
                        <ShuttleCalculator onCostChange={setShuttleCost} />
                    </div>

                    <Section header={`👥 Players`} className={styles.section}>
                        <Cell>
                            <div className={styles.counterContainer} role="group" aria-labelledby="player-count-label">
                                <div id="player-count-label" className={styles.counterLabel}>
                                    <span aria-hidden="true">👥</span>
                                    <span>Number of Players</span>
                                </div>
                                <div className={styles.counterControls}>
                                    <Button
                                        mode="outline"
                                        size="s"
                                        className={styles.counterButton}
                                        onClick={() => setPlayerCount(Math.max(2, playerCount - 1))}
                                        disabled={playerCount === 2}
                                        aria-label="Decrease player count"
                                        aria-controls="player-count-value"
                                    >
                                        <span aria-hidden="true">−</span>
                                        <span className="sr-only">Decrease</span>
                                    </Button>
                                    <div
                                        id="player-count-value"
                                        className={styles.counterValue}
                                        role="status"
                                        aria-live="polite"
                                        aria-atomic="true"
                                    >
                                        {playerCount}
                                        <span className="sr-only"> players</span>
                                    </div>
                                    <Button
                                        mode="outline"
                                        size="s"
                                        className={styles.counterButton}
                                        onClick={() => setPlayerCount(Math.min(20, playerCount + 1))}
                                        disabled={playerCount === 20}
                                        aria-label="Increase player count"
                                        aria-controls="player-count-value"
                                    >
                                        <span aria-hidden="true">+</span>
                                        <span className="sr-only">Increase</span>
                                    </Button>
                                </div>
                            </div>
                        </Cell>
                    </Section>

                    <Section
                        footer={
                            <span className={styles.footer}>
                                <span>💡</span>
                                <span>
                                    {isHost
                                        ? "Click Settle to send the bill card to the group."
                                        : `Only ${hostName || 'the host'} can settle the bill. You can view the details here.`
                                    }
                                </span>
                            </span>
                        }
                        className={styles.section}
                    >
                        <Cell>
                            <Button
                                mode="filled"
                                size="l"
                                stretched
                                className={styles.settleButton}
                                onClick={handleSettle}
                                disabled={!isHost || !courtFee || totalCost === 0}
                                aria-label={`Settle bill for RM${totalCost.toFixed(2)}, RM${perPerson.toFixed(2)} per person`}
                                aria-disabled={!isHost || !courtFee || totalCost === 0}
                            >
                                <span aria-hidden="true">💰</span> {isHost ? 'Settle Bill' : 'View Only (Host Can Settle)'}
                                <span className="sr-only"> - Total: RM{totalCost.toFixed(2)}, Per person: RM{perPerson.toFixed(2)}</span>
                            </Button>
                        </Cell>
                    </Section>
                </List>
            </div>
        </Page>
    );
};
