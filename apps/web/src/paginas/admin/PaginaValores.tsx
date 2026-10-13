import { useState } from 'react';
import { useTituloPagina } from '../../componentes';
import { api } from '../../api';
import { AvisoCarga, CabecalhoAdmin, TopoAdmin } from './ComponentesAdmin';
import { IconeCarteira, IconeRaio } from './icones';
import { data, executarAdmin, moeda, useDadosAdmin } from './useDadosAdmin';

/** Consulta e alteração do valor da contribuição. */
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
      <TopoAdmin />
      <CabecalhoAdmin
        titulo="Valores da contribuição"
        descricao="O valor é igual para todos os associados. Alterações passam a valer no próximo boleto."
      />
      <AvisoCarga carregando={carregando} erro={erro} />

      <section className="adm-cartao adm-vigente" aria-label="Valor vigente">
        <div>
          <p className="adm-vigente-rotulo">
            <span>VALOR VIGENTE</span>
            <span className="adm-etiqueta adm-etiqueta-azul">Contribuição</span>
          </p>
          <p className="adm-vigente-valor">
            {v ? moeda(v.valorMensal) : '—'} <small>/ mês por farmácia</small>
          </p>
          <p className="adm-indicador-nota">
            Desde {data(v?.vigenteDesde ?? null)} • Valor anual à vista:{' '}
            {v ? moeda(v.valorAnual) : '—'}
          </p>
        </div>
      </section>

      <section className="adm-cartao adm-bloco" aria-labelledby="t-reajuste">
        <h2 id="t-reajuste" className="adm-bloco-titulo">
          <IconeCarteira />
          Alterar contribuição mensal
        </h2>
        <p className="adm-bloco-sub">
          Associados com contribuição ativa serão avisados por e-mail sobre a
          alteração. O plano anual à vista tem o desconto previsto nos
          requisitos.
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
          <label>
            <span>Novo valor mensal (R$)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
            />
            <small>O valor anual é calculado com o desconto de 20%.</small>
          </label>
          {mensagem && (
            <p className="adm-aviso" role="status">
              {mensagem}
            </p>
          )}
          <div className="adm-formulario-acoes">
            <button type="submit" className="adm-botao-primario">
              <IconeRaio />
              Salvar novo valor
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
