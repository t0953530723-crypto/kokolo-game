export default class SaveManager {
    static SAVE_KEY = 'dungeon_crawler_save';

    static getSaveData() {
        const data = localStorage.getItem(this.SAVE_KEY);
        return data ? JSON.parse(data) : {
            bestiary: {},
            museum: [],
            leaderboard: [],
            inventory: [], // [ item objects ]
            equipped: { weapon: null, armor: null },
            talents: {
                points: 0,
                unlocked: [] // [ branch_id ]
            },
            stats: { gold: 0, highestFloor: 1, ngCount: 0, luck: 1.0 },
            checkpoint: null // For death penalty
        };
    }

    static addItem(item) {
        const data = this.getSaveData();
        data.inventory.push(item);
        this.save(data);
    }

    static removeItem(itemId) {
        const data = this.getSaveData();
        data.inventory = data.inventory.filter(i => i.id !== itemId);
        if (data.equipped.weapon?.id === itemId) data.equipped.weapon = null;
        if (data.equipped.armor?.id === itemId) data.equipped.armor = null;
        this.save(data);
    }

    static equipItem(item) {
        const data = this.getSaveData();
        // Simple logic: all items are weapons for now
        data.equipped.weapon = item;
        this.save(data);
    }

    static getEquipmentStats() {
        const data = this.getSaveData();
        let stats = { atk: 0, def: 0, spd: 0 };
        const items = [data.equipped.weapon, data.equipped.armor].filter(Boolean);
        items.forEach(item => {
            stats.atk += (item.baseStats.atk || 0);
            stats.def += (item.baseStats.def || 0);
            item.affixes.forEach(affix => {
                if (affix.label === '+Atk') stats.atk += affix.value;
                if (affix.label === '+Def') stats.def += affix.value;
                if (affix.label === '+Spd') stats.spd += affix.value;
            });
        });
        return stats;
    }

    static setCheckpoint(floor, gold, inventory, equipped) {
        const data = this.getSaveData();
        data.checkpoint = { floor, gold, inventory: [...inventory], equipped: { ...equipped } };
        this.save(data);
    }

    static revertToCheckpoint() {
        const data = this.getSaveData();
        if (data.checkpoint) {
            data.inventory = data.checkpoint.inventory;
            data.equipped = data.checkpoint.equipped;
            const result = { floor: data.checkpoint.floor, gold: data.checkpoint.gold };
            // Do not delete checkpoint? User said "Reset to before entering", maybe keep it
            this.save(data);
            return result;
        }
        return null;
    }

    static unlockTalent(id) {
        const data = this.getSaveData();
        if (!data.talents.unlocked.includes(id)) {
            data.talents.unlocked.push(id);
            this.save(data);
            return true;
        }
        return false;
    }

    static save(data) {
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
    }

    static saveKill(monsterData) {
        const data = this.getSaveData();
        if (!data.bestiary[monsterData.id]) {
            data.bestiary[monsterData.id] = { killCount: 0, data: monsterData };
        }
        data.bestiary[monsterData.id].killCount++;
        this.save(data);
    }

    static donateArtifact(artifactId) {
        const data = this.getSaveData();
        if (!data.museum.includes(artifactId)) {
            data.museum.push(artifactId);
            this.save(data);
            return true; // Newly donated
        }
        return false;
    }

    static updateLeaderboard(floor, gold, ng) {
        const data = this.getSaveData();
        data.leaderboard.push({
            floor,
            gold,
            ng,
            date: new Date().toLocaleDateString()
        });
        // Sort by floor desc
        data.leaderboard.sort((a, b) => b.floor - a.floor);
        // Keep top 10
        data.leaderboard = data.leaderboard.slice(0, 10);

        // Update highest floor
        if (floor > data.stats.highestFloor) data.stats.highestFloor = floor;
        data.stats.gold += gold;

        this.save(data);
    }

    static getGlobalBuffs() {
        const data = this.getSaveData();
        // Example: Each artifact gives +5% ATK
        return {
            atkMultiplier: 1 + (data.museum.length * 0.05),
            hpMultiplier: 1 + (data.museum.length * 0.1)
        };
    }
}
