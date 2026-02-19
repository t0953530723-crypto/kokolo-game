export default class LootManager {
    static RARITIES = {
        COMMON: { name: 'Common', color: 0xffffff, weight: 80 },
        RARE: { name: 'Rare', color: 0x00ccff, weight: 15 },
        GOLDEN: { name: 'Golden', color: 0xffd700, weight: 5 }
    };

    static AFFIX_TYPES = [
        { type: 'ATK', label: '+Atk', range: [2, 10] },
        { type: 'DEF', label: '+Def', range: [2, 10] },
        { type: 'SPD', label: '+Spd', range: [2, 10] }
    ];

    static GOLDEN_AFFIXES = [
        { type: 'VAMPIRIC', label: 'Vampiric', value: 0.1, desc: '+10% Lifesteal' },
        { type: 'BERSERK', label: 'Berserk', value: 0.5, desc: 'Atk up when low HP' },
        { type: 'HASTE', label: 'Haste', value: 25, desc: '+25 Speed' },
        { type: 'LUCKY', label: 'Lucky', value: 2.0, desc: '2x Gold & Luck' }
    ];

    static generateItem(floor, luck = 1, ng = 0) {
        const artifactProb = (floor / 100) * luck;
        const isGolden = Math.random() < artifactProb;

        let rarity = this.RARITIES.COMMON;
        if (isGolden) {
            rarity = this.RARITIES.GOLDEN;
        } else {
            const roll = Math.random() * 20;
            if (roll > 16) rarity = this.RARITIES.RARE; // Slightly buff rare chance
        }

        const scale = 1 + (floor / 50) + (ng * 1);
        const item = {
            id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: `${rarity.name} ${Phaser.Utils.Array.GetRandom(['Sword', 'Axe', 'Dagger', 'Mace'])}`,
            rarity: rarity,
            baseStats: {
                atk: Math.floor(10 * scale),
                def: Math.floor(5 * scale)
            },
            affixes: [],
            floor: floor
        };

        // Standard Affixes
        const affixCount = rarity === this.RARITIES.GOLDEN ? 3 : (rarity === this.RARITIES.RARE ? 1 : 0);
        for (let i = 0; i < affixCount; i++) {
            const type = this.AFFIX_TYPES[Math.floor(Math.random() * this.AFFIX_TYPES.length)];
            const value = Math.floor((Math.random() * (type.range[1] - type.range[0]) + type.range[0]) * scale);
            item.affixes.push({ label: type.label, value: value, type: type.type });
        }

        // Unique Golden Affix
        if (rarity === this.RARITIES.GOLDEN) {
            const unique = Phaser.Utils.Array.GetRandom(this.GOLDEN_AFFIXES);
            item.affixes.push({
                label: unique.label,
                value: unique.value,
                type: unique.type,
                isUnique: true,
                desc: unique.desc
            });
            item.name = `[Artifact] ${unique.label}`;
        }

        return item;
    }
}
