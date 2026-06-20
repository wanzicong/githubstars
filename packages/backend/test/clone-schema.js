const mysql = require('mysql2/promise')

async function main() {
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        port: 3307,
        user: 'root',
        password: '123456',
    })

    // 重建测试数据库
    await conn.query('DROP DATABASE IF EXISTS githubstars_test')
    await conn.query('CREATE DATABASE githubstars_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
    console.log('Test database created.')

    // 获取开发库所有表
    const [tables] = await conn.query('SHOW TABLES FROM githubstars')
    
    for (const row of tables) {
        const tableName = Object.values(row)[0]
        
        // 获取建表 DDL
        await conn.query('USE githubstars')
        const [createResult] = await conn.query(`SHOW CREATE TABLE githubstars.\`${tableName}\``)
        const createSql = createResult[0]['Create Table']
        
        // 在测试库中执行建表
        await conn.query('USE githubstars_test')
        await conn.query(createSql)
        console.log(`  Copied table: ${tableName}`)
    }

    // 验证
    const [testTables] = await conn.query('SHOW TABLES FROM githubstars_test')
    console.log(`\nTest database has ${testTables.length} tables.`)

    await conn.end()
    console.log('Done!')
}

main().catch(e => { console.error(e); process.exit(1) })
