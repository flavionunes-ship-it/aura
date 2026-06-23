
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Product } from '../types';
import Modal from '../components/Modal';

const ProductForm: React.FC<{ product?: Product; onSave: (product: Omit<Product, 'id'> | Product) => void; onCancel: () => void; }> = ({ product, onSave, onCancel }) => {
    const [name, setName] = useState(product?.name || '');
    const [description, setDescription] = useState(product?.description || '');
    const [price, setPrice] = useState(product?.price || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: product?.id, name, description, price: Number(price) } as Product);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nome</label>
                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            <div>
                <label htmlFor="description" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Descrição</label>
                <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"></textarea>
            </div>
            <div>
                <label htmlFor="price" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Preço (R$)</label>
                <input type="number" id="price" value={price} onChange={e => setPrice(Number(e.target.value))} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" required />
            </div>
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">Salvar</button>
            </div>
        </form>
    );
};

const ProductsPage: React.FC = () => {
    const { products, addProduct, updateProduct, deleteProduct } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
    const [search, setSearch] = useState('');

    const filteredProducts = useMemo(() => {
        if (!search.trim()) return products;
        const q = search.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
        );
    }, [products, search]);

    const handleSave = (productData: Omit<Product, 'id'> | Product) => {
        if ('id' in productData && productData.id) {
            updateProduct(productData as Product);
        } else {
            addProduct(productData);
        }
        setIsModalOpen(false);
        setEditingProduct(undefined);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Produtos & Serviços</h1>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-primary-500 focus:border-primary-500 w-full sm:w-60"
                        />
                    </div>
                    <button onClick={() => { setEditingProduct(undefined); setIsModalOpen(true); }} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 whitespace-nowrap">Adicionar Produto</button>
                </div>
            </div>

            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Descrição</th>
                            <th scope="col" className="px-6 py-3">Preço</th>
                            <th scope="col" className="px-6 py-3"><span className="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map(product => (
                            <tr key={product.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{product.name}</th>
                                <td className="px-6 py-4">{product.description}</td>
                                <td className="px-6 py-4">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Editar</button>
                                    <button onClick={() => deleteProduct(product.id)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Deletar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
                        {search ? `Nenhum produto encontrado para "${search}".` : 'Nenhum produto ou serviço cadastrado.'}
                    </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}>
                <ProductForm product={editingProduct} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default ProductsPage;
