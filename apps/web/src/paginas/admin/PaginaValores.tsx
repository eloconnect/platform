import { useState } from 'react';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { IconeCarteira, IconeEscudo, IconeRaio } from './icones';
import { data, executarAdmin, moeda, useDadosAdmin } from './useDadosAdmin';

/** Valor vigente da mensalidade e proposta de reajuste. */
export function PaginaValores() {
  useTituloPagina('Valores & Reajustes');
  const [novo, setNovo] = useState('');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const {
    dados: v,
    erro,
    carregando,
    definir,
  } = useDadosAdmin((token) => api.admin.valores(token), []);

  return (
    <>
      <TopoAdmin plantao />
      <CabecalhoAdmin
        titulo="Valores & Reajustes de Mensalidade"
        descricao="Consulte o valor atual vigente e configure uma nova proposição de reajuste com vigência para homologação da diretoria."
      />
      <AvisoCarga carregando={carregando} erro={erro} />

      <section className="adm-cartao adm-vigente" aria-label="Valor vigente">
        <div>
          <p className="adm-vigente-rotulo">
            <span>MENSALIDADE PADRÃO VIGENTE</span>
            <span className="adm-etiqueta adm-etiqueta-azul">Em Vigor</span>
          </p>
          <p className="adm-vigente-valor">
            {v ? moeda(v.valorMensal) : '—'} <small>/ mês por farmácia</small>
          </p>
          <p className="adm-indicador-nota">
            Vigência ativa desde {data(v?.vigenteDesde ?? null)} • Plano anual à
            vista: {v ? moeda(v.valorAnual) : '—'} • Cobrança automática Sicredi
          </p>
        </div>
        <div className="adm-vigente-lateral">
          <small>Estabelecimentos Filiados</small>
          <strong>{v?.estabelecimentos ?? '—'} unidades</strong>
          <span>Integradas à cobrança</span>
          <IconeEscudo />
        </div>
      </section>

      <section className="adm-cartao adm-bloco" aria-labelledby="t-reajuste">
        <h2 id="t-reajuste" className="adm-bloco-titulo">
          <IconeCarteira />
          Propor Novo Reajuste
        </h2>
        <p className="adm-bloco-sub">
          Defina o novo valor e o início da vigência para submeter à aprovação
          do conselho.
        </p>
        <form
          className="adm-formulario"
          onSubmit={async (e) => {
            e.preventDefault();
            const numero = Number(novo.replace(',', '.'));
            if (!Number.isFinite(numero) || numero <= 0) {
              setMensagem('Informe um valor mensal válido.');
              return;
            }
            const r = await executarAdmin((t) => api.admin.propor(t, numero));
            if (r.dados) {
              definir(r.dados);
              setNovo('');
            }
            setMensagem(r.erro ?? 'Novo valor registrado.');
          }}
        >
          <div className="adm-campos-2">
            <label>
              <span>Novo Valor da Mensalidade (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="195,00"
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
              />
              <small>Valor mensal aplicado a cada estabelecimento ativo</small>
            </label>
            <label>
              <span>Vigência Inicial</span>
              <input type="date" />
              <small>Data de início do novo valor para emissão bancária</small>
            </label>
          </div>
          <label>
            <span>Número da Resolução de Diretoria / Ata de Aprovação</span>
            <input
              type="text"
              placeholder="Ata da Assembleia Geral Extraordinária nº"
            />
            <small>Documento legal que fundamenta o reajuste</small>
          </label>
          {mensagem && (
            <p className="adm-aviso" role="status">
              {mensagem}
            </p>
          )}
          <div className="adm-formulario-acoes">
            <button type="submit" className="adm-botao-primario">
              <IconeRaio />
              Salvar e Enviar para Homologação
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
