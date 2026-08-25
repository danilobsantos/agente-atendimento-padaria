"use client";

import React, { useState } from "react";
import {
  UserPlus,
  ShieldCheck,
  User as UserIcon,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  KeyRound,
  Mail,
  UserCheck,
} from "lucide-react";

export interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "USER";
  createdAt: string;
}

interface UsersManagerProps {
  initialUsers: UserItem[];
  currentUserId: string;
}

export default function UsersManager({
  initialUsers,
  currentUserId,
}: UsersManagerProps) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const openCreateModal = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("USER");
    setStatus(null);
    setModalOpen(true);
  };

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setName(user.name || "");
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
    setStatus(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setStatus(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      if (editingUser) {
        // Edit user
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            ...(password ? { password } : {}),
            role,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao atualizar usuário");
        }

        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? data : u))
        );
        setStatus({
          type: "success",
          message: "Usuário atualizado com sucesso!",
        });
        setTimeout(closeModal, 1000);
      } else {
        // Create user
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            role,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao cadastrar usuário");
        }

        setUsers((prev) => [...prev, data]);
        setStatus({
          type: "success",
          message: "Usuário criado com sucesso!",
        });
        setTimeout(closeModal, 1000);
      }
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message || "Ocorreu um erro ao processar a solicitação",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    if (user.id === currentUserId) {
      alert("Você não pode excluir sua própria conta.");
      return;
    }

    if (!confirm(`Deseja realmente remover o usuário "${user.name || user.email}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao excluir usuário.");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      alert("Erro ao excluir usuário.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6B5A4B]">
          Total de usuários cadastrados:{" "}
          <strong className="text-amber-950 font-bold">{users.length}</strong>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm cursor-pointer active:scale-95 text-sm"
        >
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      {/* Users List Table */}
      <div className="bg-white border border-[#EBE2D5] rounded-2xl shadow-[0_4px_24px_rgba(46,37,27,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#2E251B]">
            <thead className="bg-[#FAF7F2] border-b border-[#EBE2D5] text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Nível de Acesso</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FAF7F2]">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                          {(user.name?.[0] || user.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-amber-950 flex items-center gap-2">
                            {user.name || "Sem nome"}
                            {isSelf && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#8C7A6B]">
                            Criado em {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-[#6B5A4B] font-mono text-xs">
                      {user.email}
                    </td>

                    <td className="px-6 py-4">
                      {user.role === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> Administrador
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 bg-stone-500/10 border border-stone-500/20 rounded-full px-3 py-1">
                          <UserCheck className="h-3.5 w-3.5" /> Usuário (Atendente)
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          title="Editar usuário"
                          className="p-2 rounded-xl border border-[#EBE2D5] bg-[#FAF7F2] hover:border-amber-600 text-[#6B5A4B] hover:text-amber-800 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          disabled={isSelf}
                          title={isSelf ? "Não é possível excluir a si mesmo" : "Excluir usuário"}
                          className="p-2 rounded-xl border border-[#EBE2D5] bg-[#FAF7F2] hover:border-rose-500 text-[#6B5A4B] hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Guide Card */}
      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)] space-y-4">
        <h3 className="font-serif font-bold text-amber-950 text-base">
          Informações sobre os Níveis de Acesso
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#EBE2D5] space-y-1.5">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-amber-700" /> Administrador
            </div>
            <p className="text-[#6B5A4B] leading-relaxed">
              Acesso total ao sistema: gerenciamento de pedidos, cardápio, live chat, empresa, usuários e às <strong>Configurações do Agente IA</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#EBE2D5] space-y-1.5">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-stone-700" /> Usuário (Atendente)
            </div>
            <p className="text-[#6B5A4B] leading-relaxed">
              Acesso ao painel de pedidos (Kanban), Live Chat, cardápio e dados da empresa. Não possui permissão para visualizar nem alterar as configurações da IA e gerenciar outros usuários.
            </p>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5 text-[#6B5A4B]" />
            </button>

            <h3 className="text-xl font-serif font-bold text-amber-950 mb-1">
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </h3>
            <p className="text-xs text-[#6B5A4B] mb-6">
              {editingUser
                ? "Atualize os dados e a permissão do usuário."
                : "Preencha os dados abaixo para cadastrar um novo integrante na equipe."}
            </p>

            {status && (
              <div
                className={`p-3.5 mb-4 rounded-xl border flex items-start gap-2 text-xs ${
                  status.type === "success"
                    ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-800 border-rose-500/20"
                }`}
              >
                {status.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-700 mt-0.5" />
                )}
                <span>{status.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  Nome Completo
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-[#A09384]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Danilo Santos"
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#A09384]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@padaria.com"
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  {editingUser ? "Nova Senha (deixe em branco para manter)" : "Senha"}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#A09384]" />
                  <input
                    type="password"
                    required={!editingUser}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] placeholder-[#A09384] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider block">
                  Nível de Acesso
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}
                  className="w-full bg-[#FAF7F2] border border-[#EBE2D5] text-[#2E251B] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 cursor-pointer"
                >
                  <option value="USER">Usuário (Atendente - Sem acesso a Configurações IA)</option>
                  <option value="ADMIN">Administrador (Acesso Total)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl border border-[#EBE2D5] text-[#6B5A4B] hover:bg-[#FAF7F2] transition-colors cursor-pointer text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer text-sm active:scale-95"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingUser ? "Salvar Alterações" : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
