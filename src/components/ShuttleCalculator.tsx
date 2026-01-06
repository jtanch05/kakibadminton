import { useState, useEffect } from 'react';
import { Section, Cell, Input, Button } from '@telegram-apps/telegram-ui';
import styles from './ShuttleCalculator.module.css';

interface ShuttleCalculatorProps {
    onCostChange: (cost: number) => void;
}

export const ShuttleCalculator = ({ onCostChange }: ShuttleCalculatorProps) => {
    const [tubePrice, setTubePrice] = useState<string>('95');
    const [usedCount, setUsedCount] = useState<number>(0);

    const calculatedCost = ((parseFloat(tubePrice) || 0) / 12) * usedCount;

    useEffect(() => {
        const price = parseFloat(tubePrice) || 0;
        const cost = (price / 12) * usedCount;
        onCostChange(cost);
    }, [tubePrice, usedCount, onCostChange]);

    const increment = () => {
        if (usedCount < 24) {
            setUsedCount(usedCount + 1);
        }
    };

    const decrement = () => {
        if (usedCount > 0) {
            setUsedCount(usedCount - 1);
        }
    };

    return (
        <div className={styles.shuttleCalculator}>
            <Section
                header={
                    <div className={styles.header}>
                        <span>
                            <span className={styles.headerIcon}>🏸</span>
                            <span> Shuttle Calculator</span>
                        </span>
                        <span className={styles.totalCost}>
                            RM{calculatedCost.toFixed(2)}
                        </span>
                    </div>
                }
                className={styles.shuttleSection}
            >
                <div className={styles.inputGroup}>
                    <Input
                        header="Tube Price (RM)"
                        placeholder="e.g. 95"
                        value={tubePrice}
                        onChange={(e) => setTubePrice(e.target.value)}
                        type="number"
                    />
                </div>

                <Cell className={styles.counterCell}>
                    <div className={styles.counterContainer}>
                        <div className={styles.counterLabel}>
                            <span className={styles.shuttleIcon}>🪶</span>
                            <span>Shuttles Used</span>
                        </div>
                        <div className={styles.counterControls}>
                            <Button
                                mode="outline"
                                size="s"
                                onClick={decrement}
                                disabled={usedCount === 0}
                                className={styles.counterButton}
                            >
                                −
                            </Button>
                            <span className={styles.counterValue}>{usedCount}</span>
                            <Button
                                mode="outline"
                                size="s"
                                onClick={increment}
                                disabled={usedCount === 24}
                                className={styles.counterButton}
                            >
                                +
                            </Button>
                        </div>
                    </div>
                </Cell>

                {usedCount > 0 && (
                    <div className={styles.costBreakdown}>
                        <span>💡</span>
                        <span>
                            <code>RM{tubePrice || 0} ÷ 12 × {usedCount}</code>
                            {' '}= RM{calculatedCost.toFixed(2)}
                        </span>
                    </div>
                )}
            </Section>
        </div>
    );
};
