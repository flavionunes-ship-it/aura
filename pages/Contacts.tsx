
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Contact, ContactType } from '../types';
import Modal from '../components/Modal';

const ContactForm: React.FC<{ contact?: Contact; onSave: (contact: Omit<Contact, 'id'> | Contact) => void; onCancel: () => void; }> = ({ contact, onSave, onCancel }) => {
    const { contactTypes } = useAppContext();
    // Basic Info
    const [name, setName] = useState(contact?.name || '');
    const [email, setEmail] = useState(contact?.email || '');
    const [phone, setPhone] = useState(contact?.phone || '');
    const [type, setType] = useState<string>(contact?.type || ContactType.CLIENT);
    
    // Additional Info
    const [address, setAddress] = useState(contact?.address || '');
    const [cpfCnpj, setCpfCnpj] = useState(contact?.cpfCnpj || '');
    const [service, setService] = useState(contact?.service || '');
    const [description, setDescription] = useState(contact?.description || '');

    // Commercial Contact
    const [commName, setCommName] = useState(contact?.commercialContact?.name || '');
    const [commEmail, setCommEmail] = useState(contact?.commercialContact?.email || '');
    const [commMobile, setCommMobile] = useState(contact?.commercialContact?.mobile || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            id: contact?.id, 
            name, 
            email, 
            phone, 
            type,
            address,
            cpfCnpj,
            service,
            description,
            commercialContact: (commName || commEmail || commMobile) ? {
                name: commName,
                email: commEmail,
                mobile: commMobile
            } : undefined
        } as Contact);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-1">Dados Gerais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome da Empresa / Pessoa</label>
                        <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
                    </div>
                    <div>
                        <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">E-mail Principal</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Telefone Principal</label>
                        <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="type" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Tipo de Contato</label>
                        <select id="type" value={type} onChange={e => setType(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                            {contactTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="cpfCnpj" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">CPF / CNPJ</label>
                        <input type="text" id="cpfCnpj" value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="service" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Serviço/Produto de Interesse</label>
                        <input type="text" id="service" value={service} onChange={e => setService(e.target.value)} placeholder="Ex: Consultoria, Desenvolvimento Web" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="address" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Endereço Completo</label>
                        <input type="text" id="address" value={address} onChange={e => setAddress(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="description" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Descrição / Observações</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"></textarea>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-1">Contato Comercial / Financeiro</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="md:col-span-2">
                        <label htmlFor="commName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome do Responsável</label>
                        <input type="text" id="commName" value={commName} onChange={e => setCommName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Ex: João da Silva" />
                    </div>
                    <div>
                        <label htmlFor="commEmail" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">E-mail do Responsável</label>
                        <input type="email" id="commEmail" value={commEmail} onChange={e => setCommEmail(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="commMobile" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Celular / WhatsApp</label>
                        <input type="tel" id="commMobile" value={commMobile} onChange={e => setCommMobile(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" />
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Salvar</button>
            </div>
        </form>
    );
};

const ContactsPage: React.FC = () => {
    const { contacts, addContact, updateContact, deleteContact, contactTypes } = useAppContext();
    const [activeTab, setActiveTab] = useState<string>(ContactType.CLIENT);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);

    const filteredContacts = useMemo(() => contacts.filter(c => c.type === activeTab), [contacts, activeTab]);

    const handleSave = (contactData: Omit<Contact, 'id'> | Contact) => {
        if ('id' in contactData && contactData.id) {
            updateContact(contactData as Contact);
        } else {
            addContact(contactData);
        }
        setIsModalOpen(false);
        setEditingContact(undefined);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contatos</h1>
                <button onClick={() => { setEditingContact(undefined); setIsModalOpen(true); }} className="mt-4 md:mt-0 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Adicionar Novo Contato</button>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <ul className="flex -mb-px text-sm font-medium text-center text-gray-500 dark:text-gray-400">
                    {contactTypes.map(type => (
                         <li className="mr-2" key={type}>
                            <button onClick={() => setActiveTab(type)} className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group whitespace-nowrap ${activeTab === type ? 'text-primary-600 border-primary-600 dark:text-primary-500 dark:border-primary-500' : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300'}`}>
                                {type}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Serviço</th>
                            <th scope="col" className="px-6 py-3">Telefone</th>
                            <th scope="col" className="px-6 py-3">Responsável</th>
                            <th scope="col" className="px-6 py-3"><span className="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredContacts.map(contact => (
                            <tr key={contact.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    <div>{contact.name}</div>
                                    <div className="text-xs text-gray-500 font-normal">{contact.email}</div>
                                    {contact.cpfCnpj && <div className="text-xs text-gray-500 font-normal">{contact.cpfCnpj}</div>}
                                </th>
                                <td className="px-6 py-4">
                                    {contact.service || <span className="text-gray-400 italic">N/A</span>}
                                </td>
                                <td className="px-6 py-4">{contact.phone}</td>
                                <td className="px-6 py-4">
                                    {contact.commercialContact?.name ? (
                                        <>
                                            <div className="text-gray-900 dark:text-white font-medium">{contact.commercialContact.name}</div>
                                            <div className="text-xs">{contact.commercialContact.mobile}</div>
                                        </>
                                    ) : (
                                        <span className="text-gray-400 italic">Não informado</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => { setEditingContact(contact); setIsModalOpen(true); }} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Editar</button>
                                    <button onClick={() => deleteContact(contact.id)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Deletar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredContacts.length === 0 && (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">Nenhum contato encontrado.</div>
                )}
            </div>

            <Modal className="max-w-4xl" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingContact ? 'Editar Contato' : 'Adicionar Novo Contato'}>
                <ContactForm contact={editingContact} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default ContactsPage;
