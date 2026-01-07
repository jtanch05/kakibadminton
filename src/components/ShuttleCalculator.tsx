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
                    <label htmlFor="tube-price" className="sr-only">
                        Price per tube of shuttlecocks in Malaysian Ringgit
                    </label>
                    <Input
                        id="tube-price"
                        header="Tube Price (RM)"
                        placeholder="e.g. 95"
                        value={tubePrice}
                        onChange={(e) => setTubePrice(e.target.value)}
                        type="number"
                        inputMode="decimal"
                        aria-label="Price per tube of shuttlecocks"
                        aria-describedby="tube-price-help"
                    />
                    <span id="tube-price-help" className="sr-only">
                        Enter the price for one tube containing 12 shuttlecocks
                    </span>
                </div>

                <Cell className={styles.counterCell}>
                    <div className={styles.counterContainer} role="group" aria-labelledby="shuttles-used-label">
                        <div id="shuttles-used-label" className={styles.counterLabel}>
                            <span className={styles.shuttleIcon} aria-hidden="true">🪶</span>
                            <span>Shuttles Used</span>
                        </div>
                        <div className={styles.counterControls}>
                            <Button
                                mode="outline"
                                size="s"
                                onClick={decrement}
                                disabled={usedCount === 0}
                                className={styles.counterButton}
                                aria-label="Decrease shuttle count"
                                aria-controls="shuttle-count-value"
                            >
                                <span aria-hidden="true">−</span>
                                <span className="sr-only">Decrease</span>
                            </Button>
                            <div
                                id="shuttle-count-value"
                                className={styles.counterValue}
                                role="status"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                {usedCount}
                                <span className="sr-only"> shuttlecocks used</span>
                            </div>
                            <Button
                                mode="outline"
                                size="s"
                                onClick={increment}
                                disabled={usedCount === 24}
                                className={styles.counterButton}
                                aria-label="Increase shuttle count"
                                aria-controls="shuttle-count-value"
                            >
                                <span aria-hidden="true">+</span>
                                <span className="sr-only">Increase</span>
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
