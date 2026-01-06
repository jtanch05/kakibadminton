import { useState, useEffect } from 'react';
import { Section, Cell, Input, Slider } from '@telegram-apps/telegram-ui';

interface ShuttleCalculatorProps {
    onCostChange: (cost: number) => void;
}

export const ShuttleCalculator = ({ onCostChange }: ShuttleCalculatorProps) => {
    const [tubePrice, setTubePrice] = useState<string>('95');
    const [usedCount, setUsedCount] = useState<number>(0);

    useEffect(() => {
        const price = parseFloat(tubePrice) || 0;
        const cost = (price / 12) * usedCount;
        onCostChange(cost);
    }, [tubePrice, usedCount]);

    return (
        <Section header={`Shuttle Calculator (Total: RM${((parseFloat(tubePrice) || 0) / 12 * usedCount).toFixed(2)})`}>
            <Input
                header="Tube Price (RM)"
                placeholder="e.g. 95"
                value={tubePrice}
                onChange={(e) => setTubePrice(e.target.value)}
                type="number"
            />
            <Cell
                description={`Used: ${usedCount} shuttles`}
            >
                <Slider
                    value={usedCount}
                    min={0}
                    max={24}
                    step={1}
                    onChange={(newVal) => setUsedCount(newVal)}
                />
            </Cell>
        </Section>
    );
};
