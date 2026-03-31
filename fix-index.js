const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndex() {
    try {
        console.log('🔄 Verbinde zu MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatroom');
        
        console.log('✅ Verbunden');
        
        const collection = mongoose.connection.db.collection('users');
        const indexes = await collection.indexes();
        console.log('📊 Vorhandene Indizes:');
        indexes.forEach(idx => console.log('   -', idx.name, ':', idx.key));

        try {
            await collection.dropIndex('email_1');
            console.log('✅ Email-Index gelöscht');
        } catch (e) {
            console.log('ℹ️ Kein email_1 Index gefunden');
        }
        
        try {
            await collection.dropIndex('email_1');
            console.log('✅ email_1 gelöscht');
        } catch (e) {}
        
        try {
            await collection.dropIndex('email');
            console.log('✅ email gelöscht');
        } catch (e) {}

        await collection.createIndex({ username: 1 }, { unique: true });
        console.log('✅ Username-Index erstellt');
        
        const newIndexes = await collection.indexes();
        console.log('📊 Neue Indizes:');
        newIndexes.forEach(idx => console.log('   -', idx.name, ':', idx.key));
        
        console.log('\n✨ Fertig! Starten Sie den Server neu.');
        
    } catch (error) {
        console.error('❌ Fehler:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

fixIndex();