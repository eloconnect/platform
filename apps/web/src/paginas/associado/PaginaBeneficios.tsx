import { api } from '../../api';
import { useTituloPagina } from '../../componentes';
import { AvisoCarga } from '../admin/ComponentesAdmin';
import { useDadosAdmin } from '../admin/useDadosAdmin';
import { Cabecalho } from './componentes';

/** Benefícios sindicais ativos e canais de suporte. */
export function PaginaBeneficios() {
  useTituloPagina('Benefícios & Suporte');
  const {
    dados: lista,
    erro,
    carregando,
  } = useDadosAdmin((token) => api.associado.beneficios(token), []);

  return (
    <>
      <Cabecalho
        selo="VANTAGENS DA FILIAÇÃO"
        titulo="Benefícios & Suporte"
        descricao="Conheça as vantagens disponíveis para a sua farmácia associada."
      />
      <AvisoCarga carregando={carregando} erro={erro} />
      <div className="as-grade-2">
        {lista?.map((b) => (
          <section key={b.id} className="as-cartao as-opcao">
            <h2>{b.titulo}</h2>
            <p>{b.descricao}</p>
          </section>
        ))}
      </div>
      <p className="as-cartao as-ajuda">
        Precisa de ajuda? Ligue para a Central Sindical Gratuita:{' '}
        <strong>0800 724 3000</strong> • Atendimento de segunda a sexta, das 8h
        às 18h.
      </p>
    </>
  );
}
