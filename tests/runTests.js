#!/usr/bin/env node
// Orquestrador da bateria de testes da API, Bot de WhatsApp e scripts CLI (npm run test)

const path = require('path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

function printHelp() {
    console.log(`
Bateria de Testes — Shimã Sushi API & Bot WhatsApp

Uso:
  npm run test                             Executa toda a bateria automatizada (API + Bot + Não-Regressão + Validação + CLI)
  npm run test -- --api                    Executa apenas a bateria dos endpoints da API (tests/api.test.js)
  npm run test -- --bot                    Executa apenas a bateria funcional do Bot WhatsApp (tests/whatsappBot.test.js)
  npm run test -- --regression             Executa apenas a suíte de não-regressão (tests/regression.test.js)
  npm run test -- --validation             Executa apenas a suíte de sanitização e validação (tests/inputValidation.test.js)
  npm run test -- --random <numero>        Executa tests/sendRandomOrder.js enviando pedido aleatório real no WhatsApp
  npm run test -- --dispatch <numero> [id] Executa tests/dispatchLastOrder.js liberando entrega pelo admin no WhatsApp
  npm run test -- <numero>                 Executa bateria automatizada + teste real no WhatsApp para <numero>
  npm run test -- --help                   Exibe esta ajuda
`);
}

function runNodeScript(scriptArgs, { captureOutput = false } = {}) {
    return spawnSync(process.execPath, scriptArgs, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: captureOutput ? 'pipe' : 'inherit',
    });
}

function verifyCliValidation() {
    const scripts = [
        { file: 'tests/sendRandomOrder.js', expectedText: 'Uso: node tests/sendRandomOrder.js' },
        { file: 'tests/dispatchLastOrder.js', expectedText: 'Uso: node tests/dispatchLastOrder.js' },
    ];

    console.log('\n[5/5] Validando comportamento dos scripts CLI sem argumentos...');
    for (const { file, expectedText } of scripts) {
        const res = runNodeScript([path.join(rootDir, file)], { captureOutput: true });
        assert.equal(res.status, 1, `${file} deveria encerrar com código 1 sem argumentos`);
        assert.ok(
            (res.stderr || '').includes(expectedText),
            `${file} deveria exibir mensagem de uso esperada`
        );
        console.log(`  ✔ ${file} rejeitou chamada sem telefone (código 1)`);
    }
}

function runAutomatedSuite() {
    const results = [];

    console.log('\n[1/5] Executando bateria dos endpoints da API (tests/api.test.js)...');
    const apiRes = runNodeScript(['--test', path.join(__dirname, 'api.test.js')]);
    results.push({ name: 'API Endpoints (tests/api.test.js)', ok: apiRes.status === 0 });

    console.log('\n[2/5] Executando bateria funcional do Bot WhatsApp (tests/whatsappBot.test.js)...');
    const botRes = runNodeScript(['--test', path.join(__dirname, 'whatsappBot.test.js')]);
    results.push({ name: 'Bot WhatsApp (tests/whatsappBot.test.js)', ok: botRes.status === 0 });

    console.log('\n[3/5] Executando bateria de não-regressão (tests/regression.test.js)...');
    const regRes = runNodeScript(['--test', path.join(__dirname, 'regression.test.js')]);
    results.push({ name: 'Não-Regressão (tests/regression.test.js)', ok: regRes.status === 0 });

    console.log('\n[4/5] Executando suíte de sanitização e validação (tests/inputValidation.test.js)...');
    const valRes = runNodeScript(['--test', path.join(__dirname, 'inputValidation.test.js')]);
    results.push({
        name: 'Sanitização e Validação (tests/inputValidation.test.js)',
        ok: valRes.status === 0,
    });

    let cliOk = false;
    try {
        verifyCliValidation();
        cliOk = true;
    } catch (error) {
        console.error(`  ✖ Validação CLI falhou: ${error.message}`);
    }
    results.push({ name: 'Validação CLI (sendRandomOrder / dispatchLastOrder)', ok: cliOk });

    console.log('\n================ RESUMO DA BATERIA AUTOMATIZADA ================');
    for (const item of results) {
        console.log(`  ${item.ok ? '✔ PASSOU' : '✖ FALHOU'} — ${item.name}`);
    }
    console.log('================================================================\n');

    return results.every((item) => item.ok);
}

async function runLiveWhatsappSuite(phone) {
    console.log(`\n[LIVE 1/2] Executando tests/sendRandomOrder.js para ${phone}...`);
    const randomRes = runNodeScript([path.join(__dirname, 'sendRandomOrder.js'), phone]);
    if (randomRes.status !== 0) {
        return false;
    }

    // Cria um pedido temporário baseado em registros existentes para validar o despacho sem alterar pedidos reais
    const dataSource = require('../src/models');
    let tempOrderId = null;

    try {
        const [customer, menuItem] = await Promise.all([
            dataSource.Customer.findOne({ order: [['id', 'ASC']] }),
            dataSource.Menu_item.findOne({ order: [['id', 'ASC']] }),
        ]);

        if (!customer || !menuItem) {
            throw new Error(
                'Não há clientes/itens no banco para criar pedido temporário de despacho.'
            );
        }

        const tempOrder = await dataSource.Order.create({
            customer_id: customer.id,
            order_date: new Date(),
            order_items_id: menuItem.id,
            total_amount: Number(menuItem.price),
            status: 'Em preparo',
        });
        tempOrderId = tempOrder.id;

        console.log(
            `\n[LIVE 2/2] Executando tests/dispatchLastOrder.js para ${phone} (pedido temporário #${tempOrderId})...`
        );
        const dispatchRes = runNodeScript([
            path.join(__dirname, 'dispatchLastOrder.js'),
            phone,
            String(tempOrderId),
        ]);
        return dispatchRes.status === 0;
    } finally {
        if (tempOrderId) {
            await dataSource.Order.destroy({ where: { id: tempOrderId } }).catch(() => {});
        }
        await dataSource.sequelize.close().catch(() => {});
    }
}

async function main() {
    const args = process.argv.slice(2);
    const firstArg = args[0] || '';

    if (firstArg === '--help' || firstArg === '-h') {
        printHelp();
        process.exit(0);
    }

    if (firstArg === '--api') {
        const res = runNodeScript(['--test', path.join(__dirname, 'api.test.js')]);
        process.exit(res.status ?? 1);
    }

    if (firstArg === '--bot') {
        const res = runNodeScript(['--test', path.join(__dirname, 'whatsappBot.test.js')]);
        process.exit(res.status ?? 1);
    }

    if (firstArg === '--regression') {
        const res = runNodeScript(['--test', path.join(__dirname, 'regression.test.js')]);
        process.exit(res.status ?? 1);
    }

    if (firstArg === '--validation') {
        const res = runNodeScript(['--test', path.join(__dirname, 'inputValidation.test.js')]);
        process.exit(res.status ?? 1);
    }

    if (firstArg === '--random') {
        const res = runNodeScript([path.join(__dirname, 'sendRandomOrder.js'), ...args.slice(1)]);
        process.exit(res.status ?? 1);
    }

    if (firstArg === '--dispatch') {
        const res = runNodeScript([path.join(__dirname, 'dispatchLastOrder.js'), ...args.slice(1)]);
        process.exit(res.status ?? 1);
    }

    if (args.length === 0) {
        const allOk = runAutomatedSuite();
        process.exit(allOk ? 0 : 1);
    }

    if (firstArg === '--all' || !firstArg.startsWith('-')) {
        const rawPhone = (firstArg === '--all' ? args.slice(1) : args).join(' ').trim();
        if (rawPhone.replace(/\D/g, '').length < 10) {
            console.error('Número inválido. Informe DDD + número com ao menos 10 dígitos.');
            printHelp();
            process.exit(1);
        }

        const automatedOk = runAutomatedSuite();
        if (!automatedOk) {
            console.error('Bateria automatizada falhou; abortando envio real no WhatsApp.');
            process.exit(1);
        }

        const liveOk = await runLiveWhatsappSuite(rawPhone);
        process.exit(liveOk ? 0 : 1);
    }

    console.error(`Opção desconhecida: ${firstArg}`);
    printHelp();
    process.exit(1);
}

main().catch((error) => {
    console.error('Erro ao executar bateria de testes:', error.message || error);
    process.exit(1);
});
