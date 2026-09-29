import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (login(user, pass)) {
      navigate("/", { replace: true });
    } else {
      setError(true);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-flow/15 font-display text-flow">
            IZ
          </span>
          <div>
            <div className="font-display text-base font-semibold leading-tight">IAZAN Sync</div>
            <div className="text-xs text-fg-faint">Conta Azul → Questor Zen</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="hairline space-y-4 rounded-2xl bg-ink-800 p-6">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-fg-faint">
              Usuario
            </label>
            <input
              value={user}
              onChange={(e) => {
                setUser(e.target.value);
                setError(false);
              }}
              autoFocus
              className="w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-fg focus:border-flow/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-fg-faint">
              Senha
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => {
                setPass(e.target.value);
                setError(false);
              }}
              className="w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-fg focus:border-flow/50"
            />
          </div>
          {error && <p className="text-sm text-danger">Usuario ou senha invalidos.</p>}
          <button
            type="submit"
            className="w-full rounded-lg border border-flow/40 bg-flow/10 py-2 text-sm font-medium text-flow transition-colors hover:bg-flow/20"
          >
            Entrar
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-fg-faint">
          Acesso restrito · homologacao ASSEJURC
        </p>
      </div>
    </div>
  );
}
