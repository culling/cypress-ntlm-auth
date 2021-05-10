const http = require("http");
const https = require("https");
const express = require("express");
const expressWs = require("express-ws");
const cors = require("cors");
const ntlm = require("express-ntlm");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const morganDebug = require("morgan-debug");
const debug = require("debug");
const webserverNtlmLog = debug("webserver:ntlm");
const pki = require("node-forge").pki;

const NTLM_HTTP_PORT = 5000;
const NTLM_HTTPS_PORT = 5001;
const HTTP_PORT = 5002;
const HTTPS_PORT = 5003;

const appNtlm = express();
const app = express();

const longReply =
  "OK\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789\n";

function initApp(app, useNtlm) {
  app.use(morganDebug("webserver:morgan", "combined"));
  app.use(bodyParser.json());
  app.use(cors());

  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render("error", {
      message: err.message,
      error: err,
    });
  });

  if (useNtlm) {
    app.use(
      ntlm({
        debug: function () {
          var args = Array.prototype.slice.apply(arguments);
          webserverNtlmLog(args);
        },
      })
    ); // Enables NTLM without check of user/pass
  }

  app.get("/api/get", (req, res) => {
    if (req.query && req.query.id) {
      let reply = {
        id: req.query.id,
      };
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(JSON.stringify(reply));
    } else {
      res.status(200).send(longReply);
    }
  });

  app.post("/api/post", (req, res) => {
    req.body.reply = "OK ÅÄÖéß";
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify(req.body));
  });

  app.put("/api/put", (req, res) => {
    req.body.reply = "OK ÅÄÖéß";
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(req.body);
  });

  app.delete("/api/delete", (req, res) => {
    if (req.query && req.query.id) {
      let reply = {
        id: req.query.id,
      };
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(JSON.stringify(reply));
    } else {
      res.status(200).send(longReply);
    }
  });

  app.use(express.static(__dirname + "/www"));

  /*
  app.get(/^.(?!((\/ws\/)|(\/api\/))).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, "/www/index.html"));
  });
  */
}

function configureCert(certServer, publicKey) {
  function yesterday() {
    let d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }

  function tomorrow() {
    let d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }

  function randomSerialNumber() {
    // generate random 16 bytes hex string
    let sn = "";
    for (let i = 0; i < 4; i++) {
      sn += ("00000000" + Math.floor(Math.random() * Math.pow(256, 4)).toString(16)).slice(-8);
    }
    return sn;
  }

  certServer.publicKey = publicKey;
  certServer.serialNumber = randomSerialNumber();
  certServer.validity.notBefore = yesterday();
  certServer.validity.notAfter = tomorrow();
  let subject = [
    {
      name: "commonName",
      value: "localhost",
    },
    {
      name: "countryName",
      value: "SE",
    },
    {
      shortName: "ST",
      value: "Legoland",
    },
    {
      name: "localityName",
      value: "Bricksburg",
    },
    {
      name: "organizationName",
      value: "TestOrg",
    },
    {
      shortName: "OU",
      value: "TestOrg",
    },
  ];
  certServer.setSubject(subject);
  certServer.setIssuer(subject);

  let extensions = [
    {
      name: "basicConstraints",
      cA: true,
    },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: "extKeyUsage",
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true,
    },
    {
      name: "nsCertType",
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true,
    },
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 2, // hostname
          value: "localhost",
        },
        {
          type: 7, // IP
          ip: "127.0.0.1",
        },
      ],
    },
    {
      name: "subjectKeyIdentifier",
    },
  ];
  certServer.setExtensions(extensions);
}

function generateSelfSignedCert(certs) {
  let keysServer = pki.rsa.generateKeyPair(1024);
  let certServer = pki.createCertificate();
  configureCert(certServer, keysServer.publicKey);
  certServer.sign(keysServer.privateKey);
  certs.certPem = pki.certificateToPem(certServer);
  certs.privateKeyPem = pki.privateKeyToPem(keysServer.privateKey);
  certs.publicKeyPem = pki.publicKeyToPem(keysServer.publicKey);
}

function addQuitApi(app, servers) {
  app.post("/api/quit", (req, res) => {
    res.status(200).send("OK, stopping servers");
    setTimeout(() => servers.forEach((s) => s.close()), 200);
  });
}

let certs = {
  certPem: "",
  privateKeyPem: "",
  publicKeyPem: "",
};
generateSelfSignedCert(certs);
let httpServer = http.createServer(app);
let httpsServer = https.createServer(
  {
    key: certs.privateKeyPem,
    cert: certs.certPem,
  },
  app
);

let ntlmHttpServer = http.createServer(appNtlm);
let ntlmHttpsServer = https.createServer(
  {
    key: certs.privateKeyPem,
    cert: certs.certPem,
  },
  appNtlm
);

expressWs(app, httpServer);
expressWs(app, httpsServer);
expressWs(appNtlm, ntlmHttpServer);
expressWs(appNtlm, ntlmHttpsServer);

initApp(app, false);
initApp(appNtlm, true);

function initWs(app) {
  app.ws("/ws/echo", function (ws, req) {
    ws.on("message", function (msg) {
      ws.send(msg);
    });
  });
}

initWs(app);
initWs(appNtlm);

const allServers = [httpServer, httpsServer, ntlmHttpServer, ntlmHttpsServer];
addQuitApi(app, allServers);
addQuitApi(appNtlm, allServers);

httpsServer.listen(HTTPS_PORT, () => {
  console.log(`listening on https://localhost:${HTTPS_PORT}!`);
});
httpServer.listen(HTTP_PORT, () => {
  console.log(`listening on http://localhost:${HTTP_PORT}!`);
});
ntlmHttpServer.listen(NTLM_HTTP_PORT, () => {
  console.log(`listening with NTLM on http://localhost:${NTLM_HTTP_PORT}!`);
});
ntlmHttpsServer.listen(NTLM_HTTPS_PORT, () => {
  console.log(`listening with NTLM on https://localhost:${NTLM_HTTPS_PORT}!`);
});
