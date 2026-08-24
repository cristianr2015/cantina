(function () {
  'use strict';

  const STORAGE_KEY = 'appLanguage';
  const SUPPORTED_LANGUAGES = ['es', 'pt', 'en'];
  const LOCALES = { es: 'es-AR', pt: 'pt-BR', en: 'en-US' };
  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  let currentLanguage = normalizeLanguage(hasDom ? document.documentElement.lang : 'es');
  let observer = null;

  const messages = {
    'Apariencia': { pt: 'Aparência', en: 'Appearance' },
    'Elegí cómo ver la aplicación': { pt: 'Escolha como visualizar o aplicativo', en: 'Choose how to view the app' },
    'Tema de la aplicación': { pt: 'Tema do aplicativo', en: 'App theme' },
    'Claro': { pt: 'Claro', en: 'Light' },
    'Oscuro': { pt: 'Escuro', en: 'Dark' },
    'Idioma': { pt: 'Idioma', en: 'Language' },
    'Elegí el idioma de la aplicación': { pt: 'Escolha o idioma do aplicativo', en: 'Choose the app language' },
    'Idioma de la aplicación': { pt: 'Idioma do aplicativo', en: 'App language' },
    'Preferencias de la aplicación': { pt: 'Preferências do aplicativo', en: 'App preferences' },
    'Verificando servidor...': { pt: 'Verificando servidor...', en: 'Checking server...' },
    'Servidor conectado': { pt: 'Servidor conectado', en: 'Server connected' },
    'Servidor sin conexión': { pt: 'Servidor sem conexão', en: 'Server offline' },
    'Nombre de usuario': { pt: 'Nome de usuário', en: 'Username' },
    'Código de empresa': { pt: 'Código da empresa', en: 'Company code' },
    'Cambiar de empresa': { pt: 'Trocar de empresa', en: 'Change company' },
    'Gestión simple para eventos reales': { pt: 'Gestão simples para eventos reais', en: 'Simple management for real events' },
    'CONTROL SIN COMPLICACIONES': { pt: 'CONTROLE SEM COMPLICAÇÕES', en: 'CONTROL WITHOUT COMPLEXITY' },
    'Todo tu evento,': { pt: 'Todo o seu evento,', en: 'Your entire event,' },
    'en un solo lugar.': { pt: 'em um só lugar.', en: 'all in one place.' },
    'Ventas, entradas, productos y resultados en tiempo real.': { pt: 'Vendas, ingressos, produtos e resultados em tempo real.', en: 'Sales, tickets, products, and results in real time.' },
    'Ventas ágiles': { pt: 'Vendas ágeis', en: 'Fast sales' },
    'Accesos con QR': { pt: 'Acessos com QR', en: 'QR access' },
    'Información en vivo': { pt: 'Informações ao vivo', en: 'Live information' },
    'Acceso a tu espacio': { pt: 'Acesso ao seu espaço', en: 'Access your workspace' },
    'Bienvenido': { pt: 'Bem-vindo', en: 'Welcome' },
    'Ingresá tus datos para continuar.': { pt: 'Insira seus dados para continuar.', en: 'Enter your details to continue.' },
    'Contraseña': { pt: 'Senha', en: 'Password' },
    'Acceder al Sistema': { pt: 'Entrar no sistema', en: 'Sign in' },
    'Administración de plataforma': { pt: 'Administração da plataforma', en: 'Platform administration' },
    'Conectado como:': { pt: 'Conectado como:', en: 'Signed in as:' },
    'Evento:': { pt: 'Evento:', en: 'Event:' },
    'Cerrar sesión': { pt: 'Sair', en: 'Sign out' },
    'Dashboard': { pt: 'Painel', en: 'Dashboard' },
    'Registrar venta': { pt: 'Registrar venda', en: 'Register sale' },
    'Entradas vendidas': { pt: 'Ingressos vendidos', en: 'Tickets sold' },
    'Gestión de gastos': { pt: 'Gestão de despesas', en: 'Expense management' },
    'Productos': { pt: 'Produtos', en: 'Products' },
    'Reportes': { pt: 'Relatórios', en: 'Reports' },
    'Configuración': { pt: 'Configurações', en: 'Settings' },
    'Activar Pro': { pt: 'Ativar Pro', en: 'Activate Pro' },
    'VERSIÓN PRO': { pt: 'VERSÃO PRO', en: 'PRO VERSION' },
    'Llevá la gestión de tus eventos al siguiente nivel': { pt: 'Leve a gestão dos seus eventos ao próximo nível', en: 'Take your event management to the next level' },
    'Activá todas las herramientas de administración, control y análisis. Elegí una licencia por uno o tres años, o sin vencimiento.': { pt: 'Ative todas as ferramentas de administração, controle e análise. Escolha uma licença por um ou três anos, ou sem vencimento.', en: 'Enable every administration, control, and analytics tool. Choose a one-year, three-year, or perpetual license.' },
    'Entradas anticipadas con QR': { pt: 'Ingressos antecipados com QR', en: 'Advance QR tickets' },
    'Emití entradas personalizadas, generá el PDF y validá cada ingreso una sola vez.': { pt: 'Emita ingressos personalizados, gere o PDF e valide cada entrada uma única vez.', en: 'Issue personalized tickets, generate the PDF, and validate each admission only once.' },
    'Entradas de cortesía': { pt: 'Ingressos de cortesia', en: 'Courtesy tickets' },
    'Registrá invitaciones sin cargo con autorización administrativa y control de acceso.': { pt: 'Registre convites gratuitos com autorização administrativa e controle de acesso.', en: 'Register complimentary invitations with administrative approval and admission control.' },
    'Inventario completo': { pt: 'Estoque completo', en: 'Complete inventory' },
    'Creá y editá productos, administrá precios y controlá el stock disponible.': { pt: 'Crie e edite produtos, gerencie preços e controle o estoque disponível.', en: 'Create and edit products, manage prices, and control available stock.' },
    'Reportes avanzados': { pt: 'Relatórios avançados', en: 'Advanced reports' },
    'Consultá ventas, entradas, asistencia, medios de pago y cierre financiero del evento.': { pt: 'Consulte vendas, ingressos, presença, formas de pagamento e fechamento financeiro do evento.', en: 'Review sales, tickets, attendance, payment methods, and the event financial close.' },
    'Registrá egresos, proveedores, categorías y pagos pendientes por cada evento.': { pt: 'Registre despesas, fornecedores, categorias e pagamentos pendentes de cada evento.', en: 'Register expenses, suppliers, categories, and pending payments for each event.' },
    'Todos los roles de usuario': { pt: 'Todos os perfis de usuário', en: 'All user roles' },
    'Creá Administradores, Vendedores y usuarios de Puerta con permisos específicos.': { pt: 'Crie Administradores, Vendedores e usuários de Entrada com permissões específicas.', en: 'Create Administrators, Sellers, and Door users with specific permissions.' },
    'Identificador de tu instalación': { pt: 'Identificador da sua instalação', en: 'Your installation ID' },
    'Solicitar licencia Pro por correo': { pt: 'Solicitar licença Pro por e-mail', en: 'Request a Pro license by email' },
    'El correo incluirá el identificador necesario para emitir una licencia compatible.': { pt: 'O e-mail incluirá o identificador necessário para emitir uma licença compatível.', en: 'The email will include the ID required to issue a compatible license.' },
    'Solicitud de licencia Pro': { pt: 'Solicitação de licença Pro', en: 'Pro license request' },
    'Hola, quiero solicitar una licencia Pro para la instalación': { pt: 'Olá, quero solicitar uma licença Pro para a instalação', en: 'Hello, I would like to request a Pro license for installation' },
    'Licencia': { pt: 'Licença', en: 'License' },
    'Licencia de la aplicación': { pt: 'Licença do aplicativo', en: 'Application license' },
    'La licencia pertenece a la empresa y se aplica automáticamente a todos sus usuarios.': { pt: 'A licença pertence à empresa e é aplicada automaticamente a todos os seus usuários.', en: 'The license belongs to the company and is automatically applied to all its users.' },
    'Empresa asociada': { pt: 'Empresa associada', en: 'Associated company' },
    'Las altas, renovaciones y vencimientos se administran desde el panel de superadministración.': { pt: 'Ativações, renovações e vencimentos são gerenciados no painel de superadministração.', en: 'Activations, renewals, and expirations are managed from the super administration panel.' },
    'Código de tu empresa': { pt: 'Código da sua empresa', en: 'Your company code' },
    'El correo incluirá el código necesario para identificar tu empresa.': { pt: 'O e-mail incluirá o código necessário para identificar sua empresa.', en: 'The email will include the code needed to identify your company.' },
    'Hola, quiero solicitar una licencia Pro para la empresa': { pt: 'Olá, quero solicitar uma licença Pro para a empresa', en: 'Hello, I would like to request a Pro license for the company' },
    'La licencia Free no vence. Las licencias Pro pueden emitirse por uno o tres años, o sin vencimiento.': { pt: 'A licença Free não expira. As licenças Pro podem ser emitidas por um ou três anos, ou sem vencimento.', en: 'The Free license does not expire. Pro licenses can be issued for one year, three years, or forever.' },
    'Sin licencia instalada': { pt: 'Nenhuma licença instalada', en: 'No license installed' },
    'Licencia instalada': { pt: 'Licença instalada', en: 'Installed license' },
    'Licencia vencida': { pt: 'Licença expirada', en: 'Expired license' },
    'Licencias no configuradas en el servidor': { pt: 'Licenças não configuradas no servidor', en: 'Licensing is not configured on the server' },
    'Instalá una licencia vigente para habilitar la aplicación.': { pt: 'Instale uma licença válida para habilitar o aplicativo.', en: 'Install a valid license to enable the application.' },
    'Contactá al superadministrador para asignar una licencia vigente a la empresa.': { pt: 'Entre em contato com o superadministrador para atribuir uma licença válida à empresa.', en: 'Contact the super administrator to assign a valid license to the company.' },
    'Incluye Dashboard, Registrar venta, Productos sin control de stock, ventas de entradas en puerta, Cierre de evento y Configuración.': { pt: 'Inclui Painel, Registrar venda, Produtos sem controle de estoque, vendas de ingressos na entrada, Fechamento do evento e Configurações.', en: 'Includes Dashboard, Register sale, Products without stock control, door ticket sales, Event closing, and Settings.' },
    'Todas las funciones de la aplicación están habilitadas.': { pt: 'Todas as funções do aplicativo estão habilitadas.', en: 'All application features are enabled.' },
    'Identificador de esta instalación': { pt: 'Identificador desta instalação', en: 'This installation ID' },
    'Clave de licencia': { pt: 'Chave de licença', en: 'License key' },
    'Instalar licencia': { pt: 'Instalar licença', en: 'Install license' },
    'Activada': { pt: 'Ativada', en: 'Activated' },
    'Vence': { pt: 'Expira', en: 'Expires' },
    'Sin vencimiento': { pt: 'Sem vencimento', en: 'No expiration' },
    'Pro': { pt: 'Pro', en: 'Pro' },
    'Completa': { pt: 'Completa', en: 'Full' },
    'Sin licencia': { pt: 'Sem licença', en: 'No license' },
    'En esta versión solamente está habilitada la venta de entradas en puerta.': { pt: 'Nesta versão, somente a venda de ingressos na entrada está habilitada.', en: 'This version only enables door ticket sales.' },
    'La licencia Free solamente permite crear usuarios Administradores.': { pt: 'A licença Free permite criar apenas usuários Administradores.', en: 'The Free license only allows Administrator users to be created.' },
    'La licencia Free conserva los roles existentes, pero no permite asignar Vendedor o Puerta.': { pt: 'A licença Free mantém os perfis existentes, mas não permite atribuir Vendedor ou Entrada.', en: 'The Free license keeps existing roles but does not allow assigning Seller or Door roles.' },
    'Resumen del evento': { pt: 'Resumo do evento', en: 'Event summary' },
    'Personas ingresadas': { pt: 'Pessoas que entraram', en: 'People checked in' },
    'Ingresos en efectivo': { pt: 'Receita em dinheiro', en: 'Cash revenue' },
    'Ingresos por Mercado Pago': { pt: 'Receita pelo Mercado Pago', en: 'Mercado Pago revenue' },
    'Productos más vendidos': { pt: 'Produtos mais vendidos', en: 'Top-selling products' },
    'Productos con stock bajo': { pt: 'Produtos com estoque baixo', en: 'Low-stock products' },
    'Seleccione el evento que desea administrar': { pt: 'Selecione o evento que deseja administrar', en: 'Select the event you want to manage' },
    'Actualizando datos…': { pt: 'Atualizando dados…', en: 'Updating data…' },
    'Inventario de Productos': { pt: 'Estoque de produtos', en: 'Product inventory' },
    'Agregar Producto': { pt: 'Adicionar produto', en: 'Add product' },
    'Ventas': { pt: 'Vendas', en: 'Sales' },
    'Nueva Venta': { pt: 'Nova venda', en: 'New sale' },
    'Últimas Ventas': { pt: 'Últimas vendas', en: 'Recent sales' },
    'ID Venta': { pt: 'ID da venda', en: 'Sale ID' },
    'Items (Resumen)': { pt: 'Itens (resumo)', en: 'Items (summary)' },
    'Items': { pt: 'Itens', en: 'Items' },
    'Vendedor': { pt: 'Vendedor', en: 'Seller' },
    'Pago': { pt: 'Pagamento', en: 'Payment' },
    'Total': { pt: 'Total', en: 'Total' },
    'Fecha': { pt: 'Data', en: 'Date' },
    'Acciones': { pt: 'Ações', en: 'Actions' },
    'Eliminar': { pt: 'Excluir', en: 'Delete' },
    'ACCESOS': { pt: 'ACESSOS', en: 'ACCESS' },
    'Venta y control de entradas': { pt: 'Venda e controle de ingressos', en: 'Ticket sales and admission control' },
    'Vendé anticipadas con QR, registrá ventas rápidas en puerta y controlá los ingresos.': { pt: 'Venda antecipados com QR, registre vendas rápidas na entrada e controle os acessos.', en: 'Sell advance QR tickets, register quick door sales, and control admissions.' },
    'Evento activo': { pt: 'Evento ativo', en: 'Active event' },
    'Seleccioná un evento': { pt: 'Selecione um evento', en: 'Select an event' },
    'Venta anticipada': { pt: 'Venda antecipada', en: 'Advance sale' },
    'Genera entrada con QR y comprobante PDF.': { pt: 'Gera ingresso com QR e comprovante em PDF.', en: 'Generates a QR ticket and PDF receipt.' },
    'Vender anticipada': { pt: 'Vender antecipado', en: 'Sell advance ticket' },
    'Venta anticipada cerrada': { pt: 'Venda antecipada encerrada', en: 'Advance sales closed' },
    'Acciones rápidas': { pt: 'Ações rápidas', en: 'Quick actions' },
    'Venta rápida en puerta': { pt: 'Venda rápida na entrada', en: 'Quick door sale' },
    'Efectivo e ingreso automático': { pt: 'Dinheiro e entrada automática', en: 'Cash and automatic admission' },
    'Entrada de cortesía': { pt: 'Ingresso cortesia', en: 'Courtesy ticket' },
    'Requiere autorización administrativa': { pt: 'Requer autorização administrativa', en: 'Requires administrator approval' },
    'Escanear QR de ingreso': { pt: 'Escanear QR de entrada', en: 'Scan admission QR' },
    'Validación de acceso en puerta': { pt: 'Validação de acesso na entrada', en: 'Door admission validation' },
    'Resumen de entradas': { pt: 'Resumo de ingressos', en: 'Ticket summary' },
    'Entradas emitidas': { pt: 'Ingressos emitidos', en: 'Tickets issued' },
    'Ingresos registrados': { pt: 'Entradas registradas', en: 'Admissions recorded' },
    'Pendientes de ingreso': { pt: 'Aguardando entrada', en: 'Pending admission' },
    'Recaudación': { pt: 'Arrecadação', en: 'Revenue' },
    'Entradas registradas': { pt: 'Ingressos registrados', en: 'Registered tickets' },
    'Buscá asistentes y gestioná sus accesos.': { pt: 'Busque participantes e gerencie seus acessos.', en: 'Search attendees and manage their admission.' },
    'Buscar por nombre, apellido o DNI': { pt: 'Buscar por nome, sobrenome ou documento', en: 'Search by first name, last name, or ID' },
    'Nombre': { pt: 'Nome', en: 'First name' },
    'Apellido': { pt: 'Sobrenome', en: 'Last name' },
    'DNI': { pt: 'Documento', en: 'ID number' },
    'Cantidad': { pt: 'Quantidade', en: 'Quantity' },
    'Tipo': { pt: 'Tipo', en: 'Type' },
    'P. Unitario': { pt: 'Preço unitário', en: 'Unit price' },
    'Ingresó': { pt: 'Entrou', en: 'Checked in' },
    'FINANZAS': { pt: 'FINANÇAS', en: 'FINANCE' },
    'Registrá y controlá los egresos del evento activo.': { pt: 'Registre e controle as despesas do evento ativo.', en: 'Register and control expenses for the active event.' },
    'Nuevo gasto': { pt: 'Nova despesa', en: 'New expense' },
    'Total registrado': { pt: 'Total registrado', en: 'Total recorded' },
    'Pagado': { pt: 'Pago', en: 'Paid' },
    'Pendiente': { pt: 'Pendente', en: 'Pending' },
    'Movimientos': { pt: 'Movimentações', en: 'Transactions' },
    'Buscar': { pt: 'Buscar', en: 'Search' },
    'Descripción, proveedor o responsable': { pt: 'Descrição, fornecedor ou responsável', en: 'Description, supplier, or responsible person' },
    'Categoría': { pt: 'Categoria', en: 'Category' },
    'Todas': { pt: 'Todas', en: 'All' },
    'Estado': { pt: 'Status', en: 'Status' },
    'Todos': { pt: 'Todos', en: 'All' },
    'Descripción': { pt: 'Descrição', en: 'Description' },
    'Proveedor': { pt: 'Fornecedor', en: 'Supplier' },
    'Responsable': { pt: 'Responsável', en: 'Responsible person' },
    'Medio de pago': { pt: 'Forma de pagamento', en: 'Payment method' },
    'Importe': { pt: 'Valor', en: 'Amount' },
    'Mis Ventas': { pt: 'Minhas vendas', en: 'My sales' },
    'CIERRE Y CONTROL': { pt: 'FECHAMENTO E CONTROLE', en: 'CLOSING AND CONTROL' },
    'Reportes del evento': { pt: 'Relatórios do evento', en: 'Event reports' },
    'Consolidá ingresos, gastos, resultado, caja y asistencia del evento seleccionado.': { pt: 'Consolide receitas, despesas, resultado, caixa e presença do evento selecionado.', en: 'Consolidate revenue, expenses, results, cash, and attendance for the selected event.' },
    'Período del informe': { pt: 'Período do relatório', en: 'Report period' },
    'Dejalo vacío para analizar el evento completo.': { pt: 'Deixe em branco para analisar o evento completo.', en: 'Leave blank to analyze the full event.' },
    'Desde': { pt: 'De', en: 'From' },
    'Hasta': { pt: 'Até', en: 'To' },
    'Aplicar': { pt: 'Aplicar', en: 'Apply' },
    'Todo el evento': { pt: 'Evento inteiro', en: 'Entire event' },
    'Tipos de reporte': { pt: 'Tipos de relatório', en: 'Report types' },
    'Cierre del evento': { pt: 'Fechamento do evento', en: 'Event closing' },
    'Resultado final, ingresos, gastos y asistencia': { pt: 'Resultado final, receitas, despesas e presença', en: 'Final result, revenue, expenses, and attendance' },
    'Caja por medio de pago': { pt: 'Caixa por forma de pagamento', en: 'Cash by payment method' },
    'Ingresos, egresos y saldo teórico': { pt: 'Receitas, despesas e saldo teórico', en: 'Revenue, expenses, and theoretical balance' },
    'Rendimiento de productos': { pt: 'Desempenho dos produtos', en: 'Product performance' },
    'Unidades, venta, costo y margen estimado': { pt: 'Unidades, vendas, custo e margem estimada', en: 'Units, sales, cost, and estimated margin' },
    'Entradas y asistencia': { pt: 'Ingressos e presença', en: 'Tickets and attendance' },
    'Vendidas, ingresadas, ausentes y recaudación': { pt: 'Vendidos, entradas, ausentes e arrecadação', en: 'Sold, checked in, absent, and revenue' },
    'Gastos por categoría': { pt: 'Despesas por categoria', en: 'Expenses by category' },
    'Pagados, pendientes y comprometidos': { pt: 'Pagos, pendentes e comprometidos', en: 'Paid, pending, and committed' },
    'Vendedores y cobranza': { pt: 'Vendedores e recebimentos', en: 'Sellers and collections' },
    'Operaciones e ingresos registrados por persona': { pt: 'Operações e receitas registradas por pessoa', en: 'Transactions and revenue recorded by person' },
    'Detalle de ventas': { pt: 'Detalhes das vendas', en: 'Sales details' },
    'Auditoría de productos, descuentos y vendedores': { pt: 'Auditoria de produtos, descontos e vendedores', en: 'Audit of products, discounts, and sellers' },
    'Padrón de entradas': { pt: 'Lista de ingressos', en: 'Ticket registry' },
    'Personas, DNI, tipo e ingreso registrado': { pt: 'Pessoas, documento, tipo e entrada registrada', en: 'People, ID, type, and recorded admission' },
    'RESULTADO': { pt: 'RESULTADO', en: 'RESULT' },
    'Resultados': { pt: 'Resultados', en: 'Results' },
    'Exportar': { pt: 'Exportar', en: 'Export' },
    'Preparando el cierre del evento...': { pt: 'Preparando o fechamento do evento...', en: 'Preparing event closing...' },
    'La selección se guarda en este dispositivo y también se puede cambiar antes de iniciar sesión.': { pt: 'A seleção é salva neste dispositivo e também pode ser alterada antes de entrar.', en: 'Your selection is saved on this device and can also be changed before signing in.' },
    'Modo visual': { pt: 'Modo visual', en: 'Display mode' },
    'Agenda': { pt: 'Agenda', en: 'Schedule' },
    'Gestión de eventos': { pt: 'Gestão de eventos', en: 'Event management' },
    'Creá y administrá cada fecha de la peña con sus propios precios, ventas y movimientos.': { pt: 'Crie e gerencie cada data do evento com seus próprios preços, vendas e movimentações.', en: 'Create and manage each event date with its own prices, sales, and transactions.' },
    'Nuevo evento': { pt: 'Novo evento', en: 'New event' },
    'registrados en la aplicación': { pt: 'registrados no aplicativo', en: 'registered in the app' },
    'seleccionado para trabajar': { pt: 'selecionado para trabalhar', en: 'selected for work' },
    'Datos de Empresa': { pt: 'Dados da empresa', en: 'Company details' },
    'Configurá la región, la moneda y los datos tributarios que correspondan.': { pt: 'Configure a região, a moeda e os dados fiscais correspondentes.', en: 'Configure the region, currency, and applicable tax details.' },
    'Datos de contacto': { pt: 'Dados de contato', en: 'Contact details' },
    'Región y moneda': { pt: 'Região e moeda', en: 'Region and currency' },
    'Región': { pt: 'Região', en: 'Region' },
    'Moneda': { pt: 'Moeda', en: 'Currency' },
    'Personalizada por el usuario': { pt: 'Personalizada pelo usuário', en: 'User-defined' },
    'Código': { pt: 'Código', en: 'Code' },
    'Símbolo': { pt: 'Símbolo', en: 'Symbol' },
    'La moneda se aplicará a todos los importes y comprobantes PDF.': { pt: 'A moeda será aplicada a todos os valores e comprovantes em PDF.', en: 'The currency will be applied to all amounts and PDF receipts.' },
    'Identificación tributaria': { pt: 'Identificação fiscal', en: 'Tax identification' },
    'Estos datos son opcionales y cambian según la región seleccionada.': { pt: 'Estes dados são opcionais e mudam conforme a região selecionada.', en: 'These details are optional and change according to the selected region.' },
    'opcional': { pt: 'opcional', en: 'optional' },
    'Esta región no tiene identificadores configurados.': { pt: 'Esta região não possui identificadores configurados.', en: 'This region has no configured identifiers.' },
    'Guardar configuración': { pt: 'Salvar configurações', en: 'Save settings' },
    'Nombre de la Empresa': { pt: 'Nome da empresa', en: 'Company name' },
    'Mi Empresa': { pt: 'Minha empresa', en: 'My company' },
    'Dirección': { pt: 'Endereço', en: 'Address' },
    'Dirección de la peña': { pt: 'Endereço do evento', en: 'Venue address' },
    'Teléfono': { pt: 'Telefone', en: 'Phone' },
    'Teléfono de contacto': { pt: 'Telefone de contato', en: 'Contact phone' },
    'Correo electrónico': { pt: 'E-mail', en: 'Email' },
    'Guardar': { pt: 'Salvar', en: 'Save' },
    'Precios de Entradas': { pt: 'Preços dos ingressos', en: 'Ticket prices' },
    'Precios del evento activo:': { pt: 'Preços do evento ativo:', en: 'Active event prices:' },
    'Los cambios se aplican a ventas nuevas y las cortesías siempre son sin cargo.': { pt: 'As alterações se aplicam a novas vendas e as cortesias são sempre gratuitas.', en: 'Changes apply to new sales and courtesy tickets are always free.' },
    'Precio de entrada anticipada': { pt: 'Preço do ingresso antecipado', en: 'Advance ticket price' },
    'Precio de entrada en puerta': { pt: 'Preço do ingresso na entrada', en: 'Door ticket price' },
    'Guardar precios': { pt: 'Salvar preços', en: 'Save prices' },
    'Logo de Empresa': { pt: 'Logo da empresa', en: 'Company logo' },
    'Seleccionar imagen': { pt: 'Selecionar imagem', en: 'Select image' },
    'Subir': { pt: 'Enviar', en: 'Upload' },
    'Tipos de Descuento': { pt: 'Tipos de desconto', en: 'Discount types' },
    'Detalle (Ej: Socio Día)': { pt: 'Detalhe (ex.: Sócio do dia)', en: 'Detail (e.g., Day member)' },
    'Agregar': { pt: 'Adicionar', en: 'Add' },
    'Detalle / Motivo': { pt: 'Detalhe / Motivo', en: 'Detail / Reason' },
    'Porcentaje': { pt: 'Porcentagem', en: 'Percentage' },
    'Equipo': { pt: 'Equipe', en: 'Team' },
    'Gestión de usuarios': { pt: 'Gestão de usuários', en: 'User management' },
    'Administrá los accesos y permisos de las personas que usan la aplicación.': { pt: 'Gerencie os acessos e permissões das pessoas que usam o aplicativo.', en: 'Manage access and permissions for people who use the app.' },
    'Nuevo usuario': { pt: 'Novo usuário', en: 'New user' },
    'registrados en el sistema': { pt: 'registrados no sistema', en: 'registered in the system' },
    'Accesos habilitados': { pt: 'Acessos habilitados', en: 'Enabled access' },
    'administración centralizada': { pt: 'administração centralizada', en: 'centralized management' },
    'Administrador': { pt: 'Administrador', en: 'Administrator' },
    'Puerta': { pt: 'Entrada', en: 'Door staff' },
    'Rol asignado': { pt: 'Função atribuída', en: 'Assigned role' },
    'Roles asignados': { pt: 'Funções atribuídas', en: 'Assigned roles' },
    'Editar usuario': { pt: 'Editar usuário', en: 'Edit user' },
    'Eliminar usuario': { pt: 'Excluir usuário', en: 'Delete user' },
    'Todavía no hay usuarios para mostrar.': { pt: 'Ainda não há usuários para mostrar.', en: 'There are no users to display yet.' },
    'Todavía no hay eventos para mostrar.': { pt: 'Ainda não há eventos para mostrar.', en: 'There are no events to display yet.' },
    'Activo': { pt: 'Ativo', en: 'Active' },
    'Finalizado': { pt: 'Finalizado', en: 'Finished' },
    'Próximo': { pt: 'Próximo', en: 'Upcoming' },
    'Anticipada': { pt: 'Antecipado', en: 'Advance' },
    'En puerta': { pt: 'Na entrada', en: 'At the door' },
    'Cortesía': { pt: 'Cortesia', en: 'Courtesy' },
    'Seleccionar': { pt: 'Selecionar', en: 'Select' },
    'Editar': { pt: 'Editar', en: 'Edit' },
    'Editar Venta': { pt: 'Editar venda', en: 'Edit sale' },
    'Eliminar Venta': { pt: 'Excluir venda', en: 'Delete sale' },
    'Editar Producto': { pt: 'Editar produto', en: 'Edit product' },
    'Eliminar Producto': { pt: 'Excluir produto', en: 'Delete product' },
    'Costo': { pt: 'Custo', en: 'Cost' },
    'Precio Venta': { pt: 'Preço de venda', en: 'Sale price' },
    'Stock': { pt: 'Estoque', en: 'Stock' },
    'Imagen (opcional)': { pt: 'Imagem (opcional)', en: 'Image (optional)' },
    'Cancelar': { pt: 'Cancelar', en: 'Cancel' },
    'Guardar Cambios': { pt: 'Salvar alterações', en: 'Save changes' },
    'Editar Orden': { pt: 'Editar pedido', en: 'Edit order' },
    'Método de Pago': { pt: 'Forma de pagamento', en: 'Payment method' },
    'Efectivo': { pt: 'Dinheiro', en: 'Cash' },
    'Mercado Pago': { pt: 'Mercado Pago', en: 'Mercado Pago' },
    'MercadoPago': { pt: 'MercadoPago', en: 'MercadoPago' },
    'Transferencia': { pt: 'Transferência', en: 'Bank transfer' },
    'Entrada': { pt: 'Ingresso', en: 'Ticket' },
    'Cerrar': { pt: 'Fechar', en: 'Close' },
    'Escanear Entrada': { pt: 'Escanear ingresso', en: 'Scan ticket' },
    'Apunta la cámara al código QR de la entrada': { pt: 'Aponte a câmera para o código QR do ingresso', en: 'Point the camera at the ticket QR code' },
    'Ingreso registrado': { pt: 'Entrada registrada', en: 'Admission recorded' },
    'Aceptar y volver': { pt: 'Aceitar e voltar', en: 'Accept and return' },
    'Venta Rápida en Puerta': { pt: 'Venda rápida na entrada', en: 'Quick door sale' },
    '¿Cuántas entradas desea registrar hoy?': { pt: 'Quantos ingressos deseja registrar hoje?', en: 'How many tickets would you like to register today?' },
    'Cantidad de entradas': { pt: 'Quantidade de ingressos', en: 'Ticket quantity' },
    'Disminuir cantidad': { pt: 'Diminuir quantidade', en: 'Decrease quantity' },
    'Aumentar cantidad': { pt: 'Aumentar quantidade', en: 'Increase quantity' },
    'Cantidad seleccionada': { pt: 'Quantidade selecionada', en: 'Selected quantity' },
    'entradas': { pt: 'ingressos', en: 'tickets' },
    'Método de pago': { pt: 'Forma de pagamento', en: 'Payment method' },
    'Continuar': { pt: 'Continuar', en: 'Continue' },
    'Seleccionar Cantidad': { pt: 'Selecionar quantidade', en: 'Select quantity' },
    'Confirmar': { pt: 'Confirmar', en: 'Confirm' },
    'Terminal de Ventas': { pt: 'Terminal de vendas', en: 'Sales terminal' },
    'Punto de Venta': { pt: 'Ponto de venda', en: 'Point of sale' },
    'Cerrar nueva venta': { pt: 'Fechar nova venda', en: 'Close new sale' },
    'Nombre del producto': { pt: 'Nome do produto', en: 'Product name' },
    'Resumen': { pt: 'Resumo', en: 'Summary' },
    'Carrito': { pt: 'Carrinho', en: 'Cart' },
    'Tu carrito esta vacio': { pt: 'Seu carrinho está vazio', en: 'Your cart is empty' },
    'Agregá productos desde la izquierda para empezar la venta.': { pt: 'Adicione produtos à esquerda para iniciar a venda.', en: 'Add products from the left to start the sale.' },
    'Subtotal': { pt: 'Subtotal', en: 'Subtotal' },
    'Total final': { pt: 'Total final', en: 'Final total' },
    'Descuento': { pt: 'Desconto', en: 'Discount' },
    'Sin descuento': { pt: 'Sem desconto', en: 'No discount' },
    'Asignar vendedor': { pt: 'Atribuir vendedor', en: 'Assign seller' },
    'Confirmar Venta': { pt: 'Confirmar venda', en: 'Confirm sale' },
    'MOVIMIENTO': { pt: 'MOVIMENTAÇÃO', en: 'TRANSACTION' },
    'Registrar gasto': { pt: 'Registrar despesa', en: 'Register expense' },
    'Completá la información del egreso.': { pt: 'Preencha as informações da despesa.', en: 'Complete the expense information.' },
    'Cerrar formulario': { pt: 'Fechar formulário', en: 'Close form' },
    'Descripción *': { pt: 'Descrição *', en: 'Description *' },
    'Ej: Compra de bebidas': { pt: 'Ex.: Compra de bebidas', en: 'E.g., beverage purchase' },
    'Categoría *': { pt: 'Categoria *', en: 'Category *' },
    'Mercadería e insumos': { pt: 'Mercadorias e insumos', en: 'Goods and supplies' },
    'Servicios': { pt: 'Serviços', en: 'Services' },
    'Logística': { pt: 'Logística', en: 'Logistics' },
    'Mantenimiento': { pt: 'Manutenção', en: 'Maintenance' },
    'Personal': { pt: 'Pessoal', en: 'Staff' },
    'Otros': { pt: 'Outros', en: 'Other' },
    'Opcional': { pt: 'Opcional', en: 'Optional' },
    'Importe *': { pt: 'Valor *', en: 'Amount *' },
    'Fecha *': { pt: 'Data *', en: 'Date *' },
    'Medio de pago *': { pt: 'Forma de pagamento *', en: 'Payment method *' },
    'Estado *': { pt: 'Status *', en: 'Status *' },
    'Sin asignar': { pt: 'Não atribuído', en: 'Unassigned' },
    'Guardar gasto': { pt: 'Salvar despesa', en: 'Save expense' },
    'CONFIRMAR PAGO': { pt: 'CONFIRMAR PAGAMENTO', en: 'CONFIRM PAYMENT' },
    'Marcar gasto como pagado': { pt: 'Marcar despesa como paga', en: 'Mark expense as paid' },
    'Elegí el medio con el que se realizará este pago.': { pt: 'Escolha a forma de pagamento desta despesa.', en: 'Choose the method used for this payment.' },
    'Confirmar pago': { pt: 'Confirmar pagamento', en: 'Confirm payment' },
    'Crear evento': { pt: 'Criar evento', en: 'Create event' },
    'Definí la fecha y los precios para comenzar.': { pt: 'Defina a data e os preços para começar.', en: 'Set the date and prices to get started.' },
    'Nombre del evento': { pt: 'Nome do evento', en: 'Event name' },
    'Ej: Peña de septiembre': { pt: 'Ex.: Evento de setembro', en: 'E.g., September event' },
    'Fecha y hora de comienzo': { pt: 'Data e hora de início', en: 'Start date and time' },
    'La venta anticipada se cerrará una hora antes.': { pt: 'A venda antecipada será encerrada uma hora antes.', en: 'Advance sales will close one hour before.' },
    'Guardar cambios': { pt: 'Salvar alterações', en: 'Save changes' },
    'Editar evento': { pt: 'Editar evento', en: 'Edit event' },
    'Actualizá la fecha y los precios de esta edición.': { pt: 'Atualize a data e os preços desta edição.', en: 'Update the date and prices for this edition.' },
    'Crear usuario': { pt: 'Criar usuário', en: 'Create user' },
    'Completá los datos para dar acceso a una persona.': { pt: 'Preencha os dados para dar acesso a uma pessoa.', en: 'Complete the details to give someone access.' },
    'Ej: María': { pt: 'Ex.: Maria', en: 'E.g., Maria' },
    'Ej: González': { pt: 'Ex.: Silva', en: 'E.g., Smith' },
    'Usuario para iniciar sesión': { pt: 'Usuário para entrar', en: 'Sign-in username' },
    'Ej: vendedor3': { pt: 'Ex.: vendedor3', en: 'E.g., seller3' },
    'Este será el dato que la persona usará para ingresar.': { pt: 'Este será o dado usado pela pessoa para entrar.', en: 'This is what the person will use to sign in.' },
    'Ingresá una contraseña': { pt: 'Digite uma senha', en: 'Enter a password' },
    'Obligatoria para crear un usuario nuevo.': { pt: 'Obrigatória para criar um novo usuário.', en: 'Required when creating a new user.' },
    'Roles y permisos': { pt: 'Funções e permissões', en: 'Roles and permissions' },
    'Ventas, productos y reportes': { pt: 'Vendas, produtos e relatórios', en: 'Sales, products, and reports' },
    'Gestión y control de entradas': { pt: 'Gestão e controle de ingressos', en: 'Ticket management and admission control' },
    'Configuración y acceso completo': { pt: 'Configurações e acesso completo', en: 'Settings and full access' },
    'Podés seleccionar uno o varios roles.': { pt: 'Você pode selecionar uma ou várias funções.', en: 'You can select one or more roles.' },
    'Confirmar Acción': { pt: 'Confirmar ação', en: 'Confirm action' },
    '¿Estás seguro?': { pt: 'Tem certeza?', en: 'Are you sure?' },
    'Autorización requerida': { pt: 'Autorização necessária', en: 'Authorization required' },
    'Ingresá las credenciales de un administrador para continuar.': { pt: 'Digite as credenciais de um administrador para continuar.', en: 'Enter administrator credentials to continue.' },
    'Usuario administrador': { pt: 'Usuário administrador', en: 'Administrator username' },
    'Autorizar y continuar': { pt: 'Autorizar e continuar', en: 'Authorize and continue' },
    'Eliminar entradas vendidas': { pt: 'Excluir ingressos vendidos', en: 'Delete sold tickets' },
    'Cantidad a eliminar': { pt: 'Quantidade a excluir', en: 'Quantity to delete' },
    'Esta acción es irreversible.': { pt: 'Esta ação é irreversível.', en: 'This action cannot be undone.' },
    'VENTA ANTICIPADA': { pt: 'VENDA ANTECIPADA', en: 'ADVANCE SALE' },
    'Nueva entrada anticipada': { pt: 'Novo ingresso antecipado', en: 'New advance ticket' },
    'Se generará una entrada con código QR.': { pt: 'Será gerado um ingresso com código QR.', en: 'A ticket with a QR code will be generated.' },
    'Valor unitario: -': { pt: 'Valor unitário: -', en: 'Unit price: -' },
    'Forma de pago': { pt: 'Forma de pagamento', en: 'Payment method' },
    'Seleccionar vendedor': { pt: 'Selecionar vendedor', en: 'Select seller' },
    'Confirmar venta': { pt: 'Confirmar venda', en: 'Confirm sale' },
    'VENTA REGISTRADA': { pt: 'VENDA REGISTRADA', en: 'SALE REGISTERED' },
    'Entradas listas para entregar': { pt: 'Ingressos prontos para entregar', en: 'Tickets ready for delivery' },
    'El PDF se guardó en el dispositivo. Elegí cómo querés entregar las entradas.': { pt: 'O PDF foi salvo no dispositivo. Escolha como deseja entregar os ingressos.', en: 'The PDF was saved to the device. Choose how to deliver the tickets.' },
    'Comprobante': { pt: 'Comprovante', en: 'Receipt' },
    'Enviar por WhatsApp': { pt: 'Enviar pelo WhatsApp', en: 'Send via WhatsApp' },
    'Compartir el PDF': { pt: 'Compartilhar o PDF', en: 'Share the PDF' },
    'Guardar como imagen': { pt: 'Salvar como imagem', en: 'Save as image' },
    'Galería o archivos del celular': { pt: 'Galeria ou arquivos do celular', en: 'Phone gallery or files' },
    'Descargar PDF': { pt: 'Baixar PDF', en: 'Download PDF' },
    'Guardar otra copia': { pt: 'Salvar outra cópia', en: 'Save another copy' },
    'Finalizar': { pt: 'Finalizar', en: 'Finish' },
    'Editar Entrada': { pt: 'Editar ingresso', en: 'Edit ticket' },
    'Cantidad total (actual + nuevas)': { pt: 'Quantidade total (atual + novas)', en: 'Total quantity (current + new)' },
    'Agregar nuevo producto': { pt: 'Adicionar novo produto', en: 'Add new product' },
    'Costo $': { pt: 'Custo $', en: 'Cost $' },
    'Precio venta $': { pt: 'Preço de venda $', en: 'Sale price $' },
    'Stock Disponible (Unidades)': { pt: 'Estoque disponível (unidades)', en: 'Available stock (units)' },
    'Guardar producto': { pt: 'Salvar produto', en: 'Save product' },
    'Cargando...': { pt: 'Carregando...', en: 'Loading...' },
    'Sí': { pt: 'Sim', en: 'Yes' },
    'No': { pt: 'Não', en: 'No' },
    'TOTAL': { pt: 'TOTAL', en: 'TOTAL' },
    'TOTALES:': { pt: 'TOTAIS:', en: 'TOTALS:' },
    'Ingresos totales': { pt: 'Receitas totais', en: 'Total revenue' },
    'Gastos registrados': { pt: 'Despesas registradas', en: 'Recorded expenses' },
    'Resultado comprometido': { pt: 'Resultado comprometido', en: 'Committed result' },
    'Gastos pendientes': { pt: 'Despesas pendentes', en: 'Pending expenses' },
    'Productos + entradas': { pt: 'Produtos + ingressos', en: 'Products + tickets' },
    'Pagados + pendientes': { pt: 'Pagos + pendentes', en: 'Paid + pending' },
    'Ingresos menos todos los gastos': { pt: 'Receitas menos todas as despesas', en: 'Revenue minus all expenses' },
    'Obligaciones todavía no pagadas': { pt: 'Obrigações ainda não pagas', en: 'Obligations not yet paid' },
    'Ingresos': { pt: 'Receitas', en: 'Revenue' },
    'Ventas de productos': { pt: 'Vendas de produtos', en: 'Product sales' },
    'Venta de entradas': { pt: 'Venda de ingressos', en: 'Ticket sales' },
    'Gastos pagados': { pt: 'Despesas pagas', en: 'Paid expenses' },
    'Resultado con pagos realizados': { pt: 'Resultado com pagamentos realizados', en: 'Result after completed payments' },
    'Operación de productos': { pt: 'Operação de produtos', en: 'Product operations' },
    'Órdenes': { pt: 'Pedidos', en: 'Orders' },
    'Unidades vendidas': { pt: 'Unidades vendidas', en: 'Units sold' },
    'Costo estimado': { pt: 'Custo estimado', en: 'Estimated cost' },
    'Margen estimado': { pt: 'Margem estimada', en: 'Estimated margin' },
    'No ingresaron': { pt: 'Não entraram', en: 'Did not check in' },
    'Asistencia': { pt: 'Presença', en: 'Attendance' },
    'Medio': { pt: 'Forma', en: 'Method' },
    'Saldo teórico': { pt: 'Saldo teórico', en: 'Theoretical balance' },
    'Producto': { pt: 'Produto', en: 'Product' },
    'Unidades': { pt: 'Unidades', en: 'Units' },
    'Venta': { pt: 'Venda', en: 'Sales' },
    'Stock final': { pt: 'Estoque final', en: 'Ending stock' },
    'Emitidas': { pt: 'Emitidos', en: 'Issued' },
    'Ingresaron': { pt: 'Entraram', en: 'Checked in' },
    'Registros': { pt: 'Registros', en: 'Records' },
    'Total comprometido': { pt: 'Total comprometido', en: 'Total committed' },
    'Ventas productos': { pt: 'Vendas de produtos', en: 'Product sales' },
    'Ingreso productos': { pt: 'Receita de produtos', en: 'Product revenue' },
    'Ingreso entradas': { pt: 'Receita de ingressos', en: 'Ticket revenue' },
    'Total recaudado': { pt: 'Total arrecadado', en: 'Total collected' },
    'Ganancia': { pt: 'Lucro', en: 'Profit' },
    'Motivo': { pt: 'Motivo', en: 'Reason' },
    'Fecha/Hora': { pt: 'Data/Hora', en: 'Date/Time' },
    'Orden': { pt: 'Pedido', en: 'Order' },
    'Precio': { pt: 'Preço', en: 'Price' },
    'Estado Ingreso': { pt: 'Status da entrada', en: 'Admission status' },
    'Cliente (Nombre y DNI)': { pt: 'Cliente (nome e documento)', en: 'Customer (name and ID)' },
    'Tipo Entrada': { pt: 'Tipo de ingresso', en: 'Ticket type' },
    'Servidor en línea': { pt: 'Servidor online', en: 'Server online' },
    'Error de Base de Datos': { pt: 'Erro no banco de dados', en: 'Database error' },
    'Error de conexión': { pt: 'Erro de conexão', en: 'Connection error' },
    'Sesión inválida': { pt: 'Sessão inválida', en: 'Invalid session' },
    'No se pudo validar la sesión. Intentá nuevamente.': { pt: 'Não foi possível validar a sessão. Tente novamente.', en: 'The session could not be validated. Please try again.' },
    'No se pudieron cargar los productos': { pt: 'Não foi possível carregar os produtos', en: 'Products could not be loaded' },
    'No se pudieron cargar los eventos': { pt: 'Não foi possível carregar os eventos', en: 'Events could not be loaded' },
    'No se pudieron cargar las ventas del evento.': { pt: 'Não foi possível carregar as vendas do evento.', en: 'Event sales could not be loaded.' },
    'No se pudieron cargar los descuentos.': { pt: 'Não foi possível carregar os descontos.', en: 'Discounts could not be loaded.' },
    'No se pudieron cargar los gastos': { pt: 'Não foi possível carregar as despesas', en: 'Expenses could not be loaded' },
    'El evento seleccionado ya no está disponible': { pt: 'O evento selecionado não está mais disponível', en: 'The selected event is no longer available' },
    'Evento eliminado': { pt: 'Evento excluído', en: 'Event deleted' },
    'Completá el nombre, la fecha, la hora y los precios del evento': { pt: 'Preencha o nome, a data, a hora e os preços do evento', en: 'Complete the event name, date, time, and prices' },
    'Completa todos los campos': { pt: 'Preencha todos os campos', en: 'Complete all fields' },
    'Completa ambos campos': { pt: 'Preencha os dois campos', en: 'Complete both fields' },
    'Esta entrada no posee QR de ingreso': { pt: 'Este ingresso não possui QR de entrada', en: 'This ticket does not have an admission QR code' },
    'Esta entrada ya fue utilizada': { pt: 'Este ingresso já foi utilizado', en: 'This ticket has already been used' },
    'Error al generar QR': { pt: 'Erro ao gerar o QR', en: 'Error generating QR code' },
    'Error al obtener lista de entradas': { pt: 'Erro ao obter a lista de ingressos', en: 'Error retrieving ticket list' },
    'Entrada no encontrada': { pt: 'Ingresso não encontrado', en: 'Ticket not found' },
    'Error al cargar datos de la entrada': { pt: 'Erro ao carregar os dados do ingresso', en: 'Error loading ticket data' },
    'Entrada actualizada correctamente': { pt: 'Ingresso atualizado corretamente', en: 'Ticket updated successfully' },
    'Estado de ingreso actualizado': { pt: 'Status da entrada atualizado', en: 'Admission status updated' },
    'Error al marcar ingreso': { pt: 'Erro ao registrar a entrada', en: 'Error recording admission' },
    'No se encontraron entradas para eliminar': { pt: 'Nenhum ingresso foi encontrado para excluir', en: 'No tickets were found to delete' },
    'Error al eliminar entradas': { pt: 'Erro ao excluir ingressos', en: 'Error deleting tickets' },
    'Complete nombre, apellido y dni': { pt: 'Preencha nome, sobrenome e documento', en: 'Complete first name, last name, and ID number' },
    'Entrada vendida agregada': { pt: 'Ingresso vendido adicionado', en: 'Sold ticket added' },
    'Seleccione una entrada para modificar': { pt: 'Selecione um ingresso para editar', en: 'Select a ticket to edit' },
    'Entrada vendida actualizada': { pt: 'Ingresso vendido atualizado', en: 'Sold ticket updated' },
    'Ingrese el nombre del producto': { pt: 'Digite o nome do produto', en: 'Enter the product name' },
    'Ingrese un precio de venta válido': { pt: 'Digite um preço de venda válido', en: 'Enter a valid sale price' },
    'La imagen es muy pesada (máximo 5MB)': { pt: 'A imagem é muito grande (máximo de 5 MB)', en: 'The image is too large (5 MB maximum)' },
    'Producto actualizado': { pt: 'Produto atualizado', en: 'Product updated' },
    'Producto agregado': { pt: 'Produto adicionado', en: 'Product added' },
    'Producto no encontrado': { pt: 'Produto não encontrado', en: 'Product not found' },
    'Producto eliminado': { pt: 'Produto excluído', en: 'Product deleted' },
    'No hay más stock disponible': { pt: 'Não há mais estoque disponível', en: 'No more stock is available' },
    'El carrito está vacío': { pt: 'O carrinho está vazio', en: 'The cart is empty' },
    'Venta registrada correctamente': { pt: 'Venda registrada corretamente', en: 'Sale registered successfully' },
    'La venta anticipada cerró una hora antes del evento': { pt: 'A venda antecipada encerrou uma hora antes do evento', en: 'Advance sales closed one hour before the event' },
    'La cantidad debe estar entre 1 y 50': { pt: 'A quantidade deve estar entre 1 e 50', en: 'Quantity must be between 1 and 50' },
    'Error al agregar entradas': { pt: 'Erro ao adicionar ingressos', en: 'Error adding tickets' },
    'Error al agregar entrada': { pt: 'Erro ao adicionar o ingresso', en: 'Error adding ticket' },
    'La fecha desde no puede ser posterior a la fecha hasta': { pt: 'A data inicial não pode ser posterior à data final', en: 'The start date cannot be later than the end date' },
    'No hay datos para exportar': { pt: 'Não há dados para exportar', en: 'There is no data to export' },
    'No hay datos procesados para exportar': { pt: 'Não há dados processados para exportar', en: 'There is no processed data to export' },
    'Reporte exportado correctamente': { pt: 'Relatório exportado corretamente', en: 'Report exported successfully' },
    'Ingresá un nombre y precios válidos': { pt: 'Digite um nome e preços válidos', en: 'Enter a valid name and prices' },
    'Configuración guardada': { pt: 'Configurações salvas', en: 'Settings saved' },
    'Seleccioná un archivo': { pt: 'Selecione um arquivo', en: 'Select a file' },
    'El logo es muy pesado (máximo 5MB)': { pt: 'O logotipo é muito grande (máximo de 5 MB)', en: 'The logo is too large (5 MB maximum)' },
    'Logo subido': { pt: 'Logotipo enviado', en: 'Logo uploaded' },
    'Error al subir logo': { pt: 'Erro ao enviar o logotipo', en: 'Error uploading logo' },
    '¿Confirmar borrado del usuario?': { pt: 'Confirmar exclusão do usuário?', en: 'Confirm user deletion?' },
    'Usuario eliminado correctamente': { pt: 'Usuário excluído corretamente', en: 'User deleted successfully' },
    'Error al eliminar usuario': { pt: 'Erro ao excluir o usuário', en: 'Error deleting user' },
    'El nombre y el apellido son requeridos': { pt: 'O nome e o sobrenome são obrigatórios', en: 'First name and last name are required' },
    'El usuario para iniciar sesión es requerido': { pt: 'O usuário de acesso é obrigatório', en: 'Sign-in username is required' },
    'La contraseña es requerida para usuarios nuevos': { pt: 'A senha é obrigatória para novos usuários', en: 'Password is required for new users' },
    'Seleccioná al menos un rol': { pt: 'Selecione pelo menos uma função', en: 'Select at least one role' },
    'Usuario actualizado correctamente': { pt: 'Usuário atualizado corretamente', en: 'User updated successfully' },
    'Usuario creado correctamente': { pt: 'Usuário criado corretamente', en: 'User created successfully' },
    'Cree o seleccione un evento para comenzar': { pt: 'Crie ou selecione um evento para começar', en: 'Create or select an event to begin' },
    'Completá descripción, categoría, importe y fecha': { pt: 'Preencha descrição, categoria, valor e data', en: 'Complete description, category, amount, and date' },
    'Gasto actualizado': { pt: 'Despesa atualizada', en: 'Expense updated' },
    'Gasto registrado': { pt: 'Despesa registrada', en: 'Expense recorded' },
    'Seleccioná un método de pago': { pt: 'Selecione uma forma de pagamento', en: 'Select a payment method' },
    'Gasto eliminado': { pt: 'Despesa excluída', en: 'Expense deleted' },
    'Venta eliminada correctamente': { pt: 'Venda excluída corretamente', en: 'Sale deleted successfully' },
    'PDF guardado nuevamente': { pt: 'PDF salvo novamente', en: 'PDF saved again' },
    'Entrada compartida correctamente': { pt: 'Ingresso compartilhado corretamente', en: 'Ticket shared successfully' },
    'No se encontraron entradas para compartir': { pt: 'Nenhum ingresso foi encontrado para compartilhar', en: 'No tickets were found to share' },
    'No se pudo compartir la entrada': { pt: 'Não foi possível compartilhar o ingresso', en: 'The ticket could not be shared' },
    'Las imágenes se guardaron en el dispositivo': { pt: 'As imagens foram salvas no dispositivo', en: 'Images were saved on the device' },
    'Desarrollado por Cristian Ramirez © 2026': { pt: 'Desenvolvido por Cristian Ramirez © 2026', en: 'Developed by Cristian Ramirez © 2026' }
  };

  function normalizeLanguage(language) {
    const shortLanguage = String(language || '').toLowerCase().split('-')[0];
    return SUPPORTED_LANGUAGES.includes(shortLanguage) ? shortLanguage : 'es';
  }

  function normalizedText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function plural(language, count, singular, pluralValue) {
    return Number(count) === 1 ? singular : pluralValue;
  }

  function translateDynamic(source, language) {
    let match;
    if ((match = source.match(/^(\d+) (usuario|usuarios)$/))) {
      return language === 'pt'
        ? `${match[1]} ${plural(language, match[1], 'usuário', 'usuários')}`
        : `${match[1]} ${plural(language, match[1], 'user', 'users')}`;
    }
    if ((match = source.match(/^(\d+) (evento|eventos)$/))) {
      return language === 'pt'
        ? `${match[1]} ${plural(language, match[1], 'evento', 'eventos')}`
        : `${match[1]} ${plural(language, match[1], 'event', 'events')}`;
    }
    if ((match = source.match(/^Comienza:\s*(.+)$/))) {
      return language === 'pt' ? `Começa: ${match[1]}` : `Starts: ${match[1]}`;
    }
    if ((match = source.match(/^Comienza\s+(.+)$/))) {
      return language === 'pt' ? `Começa em ${match[1]}` : `Starts ${match[1]}`;
    }
    if ((match = source.match(/^Actualizado:\s*(.+)$/))) {
      return language === 'pt' ? `Atualizado: ${match[1]}` : `Updated: ${match[1]}`;
    }
    if ((match = source.match(/^Evento activo:\s*(.+)$/))) {
      return language === 'pt' ? `Evento ativo: ${match[1]}` : `Active event: ${match[1]}`;
    }
    if ((match = source.match(/^Valor unitario:\s*(.+)$/))) {
      return language === 'pt' ? `Valor unitário: ${match[1]}` : `Unit price: ${match[1]}`;
    }
    if ((match = source.match(/^Disponible hasta el (.+) \(una hora antes\)\.$/))) {
      return language === 'pt' ? `Disponível até ${match[1]} (uma hora antes).` : `Available until ${match[1]} (one hour before).`;
    }
    if ((match = source.match(/^Venta cerrada desde el (.+)\.$/))) {
      return language === 'pt' ? `Venda encerrada desde ${match[1]}.` : `Sales closed since ${match[1]}.`;
    }
    if ((match = source.match(/^(\d+) entrada(?:s)? generada(?:s)?$/))) {
      return language === 'pt'
        ? `${match[1]} ${plural(language, match[1], 'ingresso gerado', 'ingressos gerados')}`
        : `${match[1]} ${plural(language, match[1], 'ticket generated', 'tickets generated')}`;
    }
    if ((match = source.match(/^Stock:\s*(.+)$/))) {
      return language === 'pt' ? `Estoque: ${match[1]}` : `Stock: ${match[1]}`;
    }
    if ((match = source.match(/^Disponible:\s*(.+)$/))) {
      return language === 'pt' ? `Disponível: ${match[1]}` : `Available: ${match[1]}`;
    }
    if ((match = source.match(/^Evento "(.+)" actualizado$/))) {
      return language === 'pt' ? `Evento "${match[1]}" atualizado` : `Event "${match[1]}" updated`;
    }
    if ((match = source.match(/^Evento "(.+)" creado y seleccionado$/))) {
      return language === 'pt' ? `Evento "${match[1]}" criado e selecionado` : `Event "${match[1]}" created and selected`;
    }
    if ((match = source.match(/^Entrada actualizada y (\d+) adicionales creadas$/))) {
      return language === 'pt'
        ? `Ingresso atualizado e ${match[1]} adicionais criados`
        : `Ticket updated and ${match[1]} additional tickets created`;
    }
    if ((match = source.match(/^(\d+) entrada\(s\) eliminada\(s\) correctamente$/))) {
      return language === 'pt' ? `${match[1]} ingresso(s) excluído(s) corretamente` : `${match[1]} ticket(s) deleted successfully`;
    }
    if ((match = source.match(/^(\d+) entrada\(s\) registrada\(s\) correctamente$/))) {
      return language === 'pt' ? `${match[1]} ingresso(s) registrado(s) corretamente` : `${match[1]} ticket(s) registered successfully`;
    }
    if ((match = source.match(/^La cantidad debe estar entre 1 y (\d+)$/))) {
      return language === 'pt' ? `A quantidade deve estar entre 1 e ${match[1]}` : `Quantity must be between 1 and ${match[1]}`;
    }
    if ((match = source.match(/^Stock insuficiente para (.+) \(Disponible: (.+)\)$/))) {
      return language === 'pt'
        ? `Estoque insuficiente para ${match[1]} (Disponível: ${match[2]})`
        : `Insufficient stock for ${match[1]} (Available: ${match[2]})`;
    }
    if ((match = source.match(/^Gasto pagado con (.+)$/))) {
      return language === 'pt' ? `Despesa paga com ${match[1]}` : `Expense paid with ${match[1]}`;
    }
    return source;
  }

  function translateCore(source, language = currentLanguage) {
    const normalizedSource = normalizedText(source);
    if (!normalizedSource || language === 'es') return normalizedSource;
    const exact = messages[normalizedSource]?.[language];
    if (exact) return exact;

    const prefixed = normalizedSource.match(/^([^\p{L}\p{N}¿¡]+)(.+)$/u);
    if (prefixed) {
      const suffixTranslation = messages[prefixed[2]]?.[language];
      if (suffixTranslation) return prefixed[1] + suffixTranslation;
    }
    return translateDynamic(normalizedSource, language);
  }

  function translatePreservingWhitespace(value, language = currentLanguage) {
    const source = String(value || '');
    const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match || !match[2]) return source;
    const translated = translateCore(match[2], language);
    return match[1] + translated + match[3];
  }

  function shouldSkipTextNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'PRE', 'CODE'].includes(parent.tagName) || parent.isContentEditable;
  }

  function translateTextNode(node, refreshSource = false) {
    if (shouldSkipTextNode(node)) return;
    if (refreshSource || !originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const translated = translatePreservingWhitespace(source);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  function attributeSourcesFor(element) {
    if (!originalAttributes.has(element)) originalAttributes.set(element, new Map());
    return originalAttributes.get(element);
  }

  function translateAttribute(element, attribute, refreshSource = false) {
    if (!element.hasAttribute(attribute)) return;
    const sources = attributeSourcesFor(element);
    if (refreshSource || !sources.has(attribute)) sources.set(attribute, element.getAttribute(attribute));
    const source = sources.get(attribute);
    const translated = translatePreservingWhitespace(source);
    if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
  }

  function translateElementAttributes(element, refreshSource = false) {
    ['placeholder', 'title', 'aria-label'].forEach(attribute => translateAttribute(element, attribute, refreshSource));
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else translateElementAttributes(node);
      node = walker.nextNode();
    }
  }

  function syncLanguageControls() {
    document.querySelectorAll('.language-select').forEach(select => {
      select.value = currentLanguage;
    });
  }

  function bindLanguageControls() {
    document.querySelectorAll('.language-select').forEach(select => {
      if (select.dataset.languageBound) return;
      select.dataset.languageBound = 'true';
      select.addEventListener('change', event => applyLanguage(event.target.value));
    });
  }

  function observeDocument() {
    if (!observer) {
      observer = new MutationObserver(records => {
        observer.disconnect();
        records.forEach(record => {
          if (record.type === 'characterData') {
            translateTextNode(record.target, true);
          } else if (record.type === 'attributes') {
            translateAttribute(record.target, record.attributeName, true);
          } else {
            record.addedNodes.forEach(node => translateTree(node));
          }
        });
        bindLanguageControls();
        syncLanguageControls();
        observeDocument();
      });
    }
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });
  }

  function applyLanguage(language, persist = true) {
    currentLanguage = normalizeLanguage(language);
    document.documentElement.lang = currentLanguage;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, currentLanguage);
      } catch (error) {
        console.warn('No se pudo guardar el idioma seleccionado', error);
      }
    }
    if (observer) observer.disconnect();
    translateTree(document);
    bindLanguageControls();
    syncLanguageControls();
    observeDocument();
    document.dispatchEvent(new CustomEvent('app:languagechange', { detail: { language: currentLanguage } }));
  }

  const publicApi = {
    applyLanguage,
    getLanguage: () => currentLanguage,
    getLocale: () => LOCALES[currentLanguage],
    t: (text, language = currentLanguage) => translateCore(text, normalizeLanguage(language)),
    translateTree
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      normalizeLanguage,
      translate: (text, language) => translateCore(text, normalizeLanguage(language)),
      localeFor: language => LOCALES[normalizeLanguage(language)]
    };
  }

  if (!hasDom) return;

  window.I18N = publicApi;
  window.t = publicApi.t;

  applyLanguage(currentLanguage, false);
})();
