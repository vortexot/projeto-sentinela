
const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend"), { extensions: ["html"] }));

// Na Vercel o disco é somente leitura (exceto /tmp, que não é permanente)
const DB_SEED = path.join(__dirname, "db.json");
const DB_FILE = process.env.VERCEL ? path.join(os.tmpdir(), "db.json") : DB_SEED;
if (process.env.VERCEL && !fs.existsSync(DB_FILE)) fs.copyFileSync(DB_SEED, DB_FILE);

// ========================================
// BANCO DE DADOS
// ========================================

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const inicial = {
            usuarios: [],
            pacientes: [],
            triagens: [],
            consultas: []
        };

        writeDB(inicial);
        return inicial;
    }

    const conteudo = fs.readFileSync(DB_FILE, "utf8");

    if (!conteudo.trim()) {
        const inicial = {
            usuarios: [],
            pacientes: [],
            triagens: [],
            consultas: []
        };

        writeDB(inicial);
        return inicial;
    }

    const db = JSON.parse(conteudo);

    db.usuarios = db.usuarios || [];
    db.pacientes = db.pacientes || [];
    db.triagens = db.triagens || [];
    db.consultas = db.consultas || [];
    db.chamadas = db.chamadas || [];

    return db;
}

function writeDB(data) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// ========================================
// NORMALIZAR TRIAGENS ANTIGAS
// ========================================

function normalizarTriagem(t) {
    return {
        ...t,
        sintoma: t.sintoma || t.sintomas || "",
        temperatura: t.temperatura ?? t.temp ?? "",
        alergia: t.alergia || "",
        observacao: t.observacao || "",
        risco: t.risco || "verde",
        status: t.status || "aguardando_medico"
    };
}

// ========================================
// CADASTRAR USUÁRIO
// ========================================

app.post("/usuarios", (req, res) => {
    try {
        const { usuario, senha, tipo } = req.body;

        if (
            typeof usuario !== "string" ||
            typeof senha !== "string" ||
            !usuario.trim() ||
            !senha
        ) {
            return res.status(400).json({
                erro: "Preencha usuário e senha."
            });
        }

        const setoresValidos = [
            "atendimento",
            "triagem",
            "medico",
            "almoxarifado",
            "admin"
        ];

        if (!setoresValidos.includes(tipo)) {
            return res.status(400).json({
                erro: "Setor inválido."
            });
        }

        const db = readDB();
        const nomeUsuario = usuario.trim();

        const existe = db.usuarios.some(
            u => u.usuario?.toLowerCase() === nomeUsuario.toLowerCase()
        );

        if (existe) {
            return res.status(409).json({
                erro: "Esse usuário já está cadastrado."
            });
        }

        const novoUsuario = {
            id: Date.now(),
            usuario: nomeUsuario,
            senha,
            tipo
        };

        db.usuarios.push(novoUsuario);
        writeDB(db);

        return res.status(201).json({
            mensagem: "Usuário cadastrado com sucesso!",
            usuario: novoUsuario.usuario,
            tipo: novoUsuario.tipo
        });

    } catch (erro) {
        console.error(erro);
        return res.status(500).json({
            erro: "Erro ao cadastrar usuário."
        });
    }
});

// ========================================
// LISTAR USUÁRIOS
// ========================================

app.get("/usuarios", (req, res) => {
    try {
        const db = readDB();

        const usuarios = db.usuarios.map(u => ({
            id: u.id,
            usuario: u.usuario,
            tipo: u.tipo
        }));

        res.json(usuarios);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro ao carregar usuários."
        });
    }
});

// ========================================
// LOGIN
// ========================================

app.post("/login", (req, res) => {
    try {
        const { usuario, senha } = req.body;

        if (
            typeof usuario !== "string" ||
            typeof senha !== "string" ||
            !usuario.trim() ||
            !senha
        ) {
            return res.status(400).json({
                erro: "Informe usuário e senha."
            });
        }

        const db = readDB();

        const user = db.usuarios.find(u =>
            u.usuario?.toLowerCase() === usuario.trim().toLowerCase() &&
            u.senha === senha
        );

        if (!user) {
            return res.status(401).json({
                erro: "Usuário ou senha inválidos."
            });
        }

        return res.json({
            id: user.id,
            usuario: user.usuario,
            tipo: user.tipo
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro no login."
        });
    }
});

// ========================================
// ATENDIMENTO - CADASTRAR PACIENTE
// ========================================

app.post("/atendimento", (req, res) => {
    try {
        const { nome, cpf, tipo } = req.body;

        if (!nome?.trim()) {
            return res.status(400).json({
                erro: "Informe o nome do paciente."
            });
        }

        const db = readDB();

        const paciente = {
            id: Date.now(),
            nome: nome.trim(),
            cpf: cpf || "",
            tipo: tipo || "Particular",
            status: "triagem",
            createdAt: new Date().toISOString()
        };

        db.pacientes.push(paciente);
        writeDB(db);

        return res.status(201).json(paciente);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro ao cadastrar paciente."
        });
    }
});

// ========================================
// LISTAR PACIENTES PARA TRIAGEM
// ========================================

app.get("/pacientes", (req, res) => {
    try {
        const db = readDB();

        const pacientes = db.pacientes.filter(p =>
            p.status === "triagem"
        );

        return res.json(pacientes);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro ao carregar pacientes."
        });
    }
});

// ========================================
// REGISTRAR TRIAGEM
// ========================================

app.post("/triagem", (req, res) => {
    try {
        const db = readDB();

        const { nome, sintoma, temperatura, alergia, observacao } = req.body;

        if (!nome?.trim()) {
            return res.status(400).json({
                erro: "Nome do paciente não informado."
            });
        }

        let risco = req.body.risco || "verde";

        const temp = Number(temperatura);

        if (temperatura !== "" && temperatura != null && Number.isFinite(temp)) {
            if (temp >= 39) {
                risco = "vermelho";
            } else if (temp >= 38) {
                risco = "amarelo";
            }
        }

        const triagem = {
            id: Date.now(),
            nome: nome.trim(),
            sintoma: sintoma || "",
            temperatura: temperatura ?? "",
            alergia: alergia || "",
            observacao: observacao || "",
            risco,
            status: "aguardando_medico",
            createdAt: new Date().toISOString()
        };

        db.triagens.push(triagem);

        // Atualiza o paciente original
        const paciente = db.pacientes.find(p =>
            p.nome?.trim().toLowerCase() === nome.trim().toLowerCase() &&
            p.status === "triagem"
        );

        if (paciente) {
            paciente.status = "aguardando_medico";
        }

        writeDB(db);

        return res.status(201).json(triagem);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro ao registrar triagem."
        });
    }
});

// ========================================
// LISTAR TRIAGENS PARA O MÉDICO
// ========================================

app.get("/triagens", (req, res) => {
    try {
        const db = readDB();

        const triagens = db.triagens
            .map(normalizarTriagem)
            .filter(t => t.status === "aguardando_medico");

        return res.json(triagens);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro ao carregar triagens."
        });
    }
});

// ========================================
// LISTA DE MEDICAÇÕES
// ========================================

app.get("/lista-medicacoes", (req, res) => {
    res.json([
        "Dipirona",
        "Paracetamol",
        "Ibuprofeno",
        "Amoxicilina",
        "Azitromicina",
        "Loratadina",
        "Omeprazol",
        "Buscopan",
        "Dramin",
        "Soro fisiológico"
    ]);
});

// ========================================
// CONSULTA MÉDICA
// ========================================

app.post("/consulta", (req, res) => {
    try {
        const { paciente, diagnostico, medicacao, obs } = req.body;

        if (!paciente?.trim()) {
            return res.status(400).json({
                erro: "Selecione um paciente."
            });
        }

        const db = readDB();

        const consulta = {
            id: Date.now(),
            paciente,
            diagnostico: diagnostico || "",
            medicacao: medicacao || "",
            obs: obs || "",
            createdAt: new Date().toISOString()
        };

        db.consultas.push(consulta);

        // Atualiza a situação da triagem atendida
        const triagem = db.triagens.find(t =>
            t.nome?.trim().toLowerCase() === paciente.trim().toLowerCase() &&
            (!t.status || t.status === "aguardando_medico")
        );

        if (triagem) {
            triagem.status = "atendido";
        }

        writeDB(db);

        return res.status(201).json(consulta);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro ao salvar consulta."
        });
    }
});

// ========================================
// LISTAR CONSULTAS
// ========================================

app.get("/medicacoes", (req, res) => {
    try {
        const db = readDB();
        res.json(db.consultas);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({
            erro: "Erro ao carregar consultas."
        });
    }
});

// ========================================
// PAINEL DA TV
// ========================================

app.post("/tv/chamar", (req, res) => {
    try {
        const { localTipo, localNumero, paciente } = req.body;

        if (typeof paciente !== "string" || !paciente.trim()) {
            return res.status(400).json({ erro: "Informe o paciente." });
        }

        const db = readDB();

        const chamada = {
            id: Date.now(),
            localTipo: String(localTipo || "GUICHÊ").toUpperCase(),
            localNumero: String(localNumero || "01"),
            paciente: paciente.trim(),
            createdAt: new Date().toISOString()
        };

        db.chamadas.push(chamada);
        db.chamadas = db.chamadas.slice(-30);
        writeDB(db);

        return res.status(201).json(chamada);

    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao chamar paciente." });
    }
});

app.get("/tv/chamada", (req, res) => {
    try {
        const db = readDB();
        const ordem = [...db.chamadas].reverse();

        res.json({
            chamada: ordem[0] || null,
            historico: ordem.slice(1)
        });

    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao carregar chamadas." });
    }
});

module.exports = app;
