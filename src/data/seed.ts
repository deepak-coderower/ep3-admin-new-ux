import { ASSOC, ROLES_BY_TYPE, TABS, type Firm } from '@/data/config'
import { slug } from '@/lib/format'

export const makeFirm = (name: string, type: string, extra: Record<string, any> = {}): Firm => ({
  id: slug(name), name, type, state: 'active', deleted: false,
  altNames: [], personnel: [], aliases: [], users: [], accounts: [], positions: [], limits: [], assoc: {}, services: [],
  ...extra,
})
const user = (id: string, displayName: string, role: string, state = 'Active') => ({ id, displayName, role, state, groupName: '' })
const account = (id: string, accountType: string, clearingMember: string, extra: Record<string, any> = {}) => ({
  id, displayName: id, accountType, state: 'Active', clearingMember, clearingHouse: 'Connamara Clearing House',
  riskSystem: 'Default', riskProfile: '', collateralReturnEnabled: false, collateralAccount: '', priorityWeight: '',
  orderSizeLow: '', orderSizeLowSet: false, orderSizeHigh: '', orderSizeHighSet: false, ...extra,
})
const service = (id: string, description: string, role: string, keys: any[] = []) => ({ id, description, role, state: 'Active', keys })

const baseFirms = (): Firm[] => [
  makeFirm('DefaultExchangeSupervisorFirm', 'supervisor', {
    users: [user('admin', 'Exchange Admin', 'Supervisor Admin'), user('ops.supervisor', 'Ops Supervisor', 'Supervisor Exchange Operation Admin')],
    services: [service('surveillance-feed', 'Market surveillance export', 'Supervisor Read Only Admin', [{ id: 'surveillance-prod', description: 'Production export', role: 'Supervisor Read Only Admin', jti: 'a91f-2c7e-44d0' }])],
  }),
  makeFirm('MGEX', 'clearingHouse', { organizationType: 'C Corporation', legalName: 'MGEX Clearing', mainAddressCity: 'Minneapolis', mainAddressState: 'MN', mainAddressCountryCode: 'US', assoc: { clearingMembers: ['Clearing-Member-A'] } }),
  makeFirm('Connamara Clearing House', 'clearingHouse', {
    organizationType: 'Limited Liability Company', legalName: 'Connamara Clearing House LLC', legalEntityIdentifier: '5493001KJTIIGC8Y1R12',
    businessContactName: 'Jordan Reyes', email: 'clearing@example.com', phoneNumber: '+1 312 555 0142',
    designatedSelfRegulatoryOrganization: 'NFA', designatedExaminingAuthority: 'CFTC',
    mainAddress1: '200 W Jackson Blvd', mainAddressCity: 'Chicago', mainAddressState: 'IL', mainAddressPostalCode: '60606', mainAddressCountryCode: 'US',
    usTaxpayerIdentificationNumber: '36-5550142',
    accounts: [account('CCH-House', 'House Trader', 'Connamara Clearing')],
    assoc: { clearingMembers: ['Connamara-Clearing'] },
  }),
  makeFirm('Connamara Clearing', 'clearingMember', {
    organizationType: 'Limited Liability Company', legalName: 'Connamara Clearing LLC', businessContactName: 'Sam Patel', email: 'members@example.com',
    mainAddress1: '200 W Jackson Blvd', mainAddressCity: 'Chicago', mainAddressState: 'IL', mainAddressPostalCode: '60606', mainAddressCountryCode: 'US',
    users: [user('sam.patel', 'Sam Patel', 'Supervisor Onboarding Admin')],
    accounts: [account('CC-Omnibus', 'Customer', 'Connamara Clearing', { riskProfile: 'Standard' })],
    assoc: { participants: ['Connamara-Trading', 'A1-Trading'], clearingHouses: ['Connamara-Clearing-House'] },
    services: [service('drop-copy', 'Post-trade drop copy feed', 'Supervisor Read Only Admin')],
  }),
  makeFirm('Connamara Trading', 'participant', {
    participantType: 'Financial Entity', organizationType: 'Limited Liability Company', legalName: 'Connamara Trading LLC', riskGroup: 'RG-1042',
    legalEntityIdentifier: '5493006MHB84DD0ZWV18', businessContactName: 'Alex Morgan', email: 'trading@example.com', phoneNumber: '+1 312 555 0187',
    usTaxpayerIdentificationNumber: '36-5550187', designatedSelfRegulatoryOrganization: 'NFA', designatedExaminingAuthority: 'CFTC',
    mainAddress1: '311 S Wacker Dr', mainAddress2: 'Suite 2400', mainAddressCity: 'Chicago', mainAddressState: 'IL', mainAddressPostalCode: '60606', mainAddressCountryCode: 'US',
    hasSponsoredDirectMarketAccess: true,
    altNames: [{ name: 'Connamara Technologies Trading' }],
    personnel: [{ name: 'Alex Morgan', email: 'alex.morgan@example.com', phoneNumber: '+1 312 555 0187', role: 'CEO', addressCity: 'Chicago', addressState: 'IL' }, { name: 'Riley Chen', email: 'riley.chen@example.com', phoneNumber: '+1 312 555 0133', role: 'CCO' }],
    aliases: [{ option: 'CFTC', alias: 'CONN-TRD-01' }],
    users: [user('alex.morgan', 'Alex Morgan', 'Trading'), user('riley.chen', 'Riley Chen', 'Trading Read Only'), user('desk.bot', 'Desk Bot', 'Drop Copy', 'Suspended')],
    accounts: [
      account('CT-Main', 'Customer', 'Connamara Clearing', { riskProfile: 'Standard', orderSizeLow: 1, orderSizeLowSet: true, orderSizeHigh: 500, orderSizeHighSet: true }),
      account('CT-Prop', 'House Trader', 'Connamara Clearing', { collateralReturnEnabled: true, collateralAccount: 'CT-Main' }),
    ],
    positions: [
      { account: 'CT-Main', symbol: 'BTC-DEC26', subType: 'Long', bod: 12, open: 18, bought: 9, sold: 3, unsettled: 6 },
      { account: 'CT-Prop', symbol: 'ETH-DEC26', subType: 'Short', bod: -40, open: -35, bought: 10, sold: 5, unsettled: 5 },
    ],
    limits: [{ product: 'BTC', symbol: '', aggregated: true, shortPositionLimit: 500, longPositionLimit: 500 }, { product: '', symbol: 'ETH-DEC26', aggregated: false, shortPositionLimit: 1200, longPositionLimit: 1500 }],
    assoc: { affiliated: ['A1-Trading'], rfq: ['Northline-Capital'], agent: ['Connamara-Agent-Firm'], clearingMembers: ['Connamara-Clearing'] },
  }),
  makeFirm('Connamara Agent Firm', 'agent', { users: [user('agent.desk', 'Agent Desk', 'Broker')], assoc: { participants: ['Connamara-Trading'] } }),
  makeFirm('Clearing Member A', 'clearingMember', { organizationType: 'General Partnership', email: 'cma@example.com', assoc: { clearingHouses: ['MGEX'] } }),
  makeFirm('A1 Trading', 'participant', { participantType: 'US Person', organizationType: 'C Corporation', legalName: 'A1 Trading Inc', email: 'desk@example.com', riskGroup: 'RG-2201', accounts: [account('A1-Main', 'Customer', 'Connamara Clearing')], assoc: { clearingMembers: ['Connamara-Clearing'] } }),
  makeFirm('Clearing-House', 'clearingHouse'),
  makeFirm('DCM-Internal-Clearing-Member', 'clearingMember', { isDisintermediated: true, legalName: 'DCM Internal Clearing' }),
  makeFirm('Northline Capital', 'participant', { participantType: 'Financial Entity', organizationType: 'Limited Partnership', legalName: 'Northline Capital LP', businessContactName: 'Casey Lindqvist', email: 'ops@example.com' }),
  makeFirm('Harbor Point Markets', 'participant', { state: 'suspended', participantType: 'Swap Dealer', organizationType: 'Limited Liability Company', legalName: 'Harbor Point Markets LLC', skipRiskAndCurrencyChecks: true }),
  makeFirm('Lakeshore Futures', 'clearingMember', { organizationType: 'C Corporation', mainAddressCity: 'Chicago', mainAddressState: 'IL' }),
  makeFirm('Meridian Prop', 'participant', { participantType: 'US Person', applyCommissionsAsSpread: true }),
  makeFirm('Vantage Execution', 'agent', { state: 'suspended' }),
  makeFirm('Summit Liquidity', 'participant', { participantType: 'Major Swap Participant', organizationType: 'Limited Liability Company' }),
  makeFirm('Blue Ridge Trading', 'participant', { participantType: 'Non US Person', mainAddressCountryCode: 'CA' }),
  makeFirm('Orchard Clearing', 'clearingMember', { state: 'suspended' }),
  makeFirm('Tidewater Commodities', 'participant', { participantType: 'US Person', legalName: 'Tidewater Commodities Inc' }),
  makeFirm('Granite Peak Partners', 'participant', { organizationType: 'General Partnership' }),
  makeFirm('Crestline Agency', 'agent'),
  makeFirm('Pioneer Grain Co', 'participant', { participantType: 'Financial Entity', mainAddressState: 'MN' }),
  makeFirm('Legacy Markets', 'participant', { deleted: true, participantType: 'US Person' }),
  makeFirm('Old Harbor Clearing', 'clearingMember', { deleted: true }),
]

const SAMPLE_PEOPLE = ['Maya Fischer', 'Daniel Okafor', 'Priya Nair', 'Tom Becker', 'Elena Rossi', 'Marcus Hill', 'Aisha Khan', 'Liam Walsh', 'Sofia Alvarez', 'Noah Kim', 'Grace Lin', 'Owen Murphy', 'Hannah Weiss', 'Ravi Menon', 'Chloe Martin', 'Ethan Brooks', 'Nina Petrova', 'Lucas Silva', 'Zoe Adams', 'Isaac Cohen', 'Tara Singh', 'Ben Carter', 'Julia Novak', 'Sean Doyle']
const SAMPLE_ACCOUNT_NAMES = ['Main', 'Prop', 'Hedge', 'Arb', 'Omnibus', 'Client-A', 'Client-B', 'Treasury']
const SAMPLE_ACCOUNT_TYPES: Record<string, string[]> = {
  participant: ['Customer', 'House Trader', 'Non Customer', 'Liquidity Provider', 'Futures Market Maker', 'Joint Back Office'],
  clearingMember: ['Customer', 'Aggregated Multiple Customers', 'House Trader', 'Operating', 'Clearing Fund', 'Non Customer'],
  clearingHouse: ['Clearing Fund', 'Operating', 'House Trader', 'Customer', 'Aggregated Customer And Non Customer', 'Non Customer'],
}
const SAMPLE_RISK_PROFILES = ['Standard', '', 'Conservative', 'Aggressive']
const SAMPLE_PRODUCTS = ['BTC', 'ETH', 'SOL', 'WTI', 'GC', 'ES']
const SAMPLE_SYMBOLS = ['BTC-DEC26', 'ETH-DEC26', 'SOL-MAR27', 'WTI-JAN27', 'GC-FEB27', 'ES-DEC26']
const SAMPLE_SERVICES = [['market-data-feed', 'Real-time market data'], ['risk-gateway', 'Pre-trade risk checks'], ['settlement-export', 'End-of-day settlement files'], ['position-sync', 'Position reconciliation'], ['audit-export', 'Audit trail export']]
const SAMPLE_KEYS = ['primary', 'backup', 'staging']
const SAMPLE_ROLES = ['CEO', 'CFO', 'CCO', 'CRO', 'Authorized Representative']
const SAMPLE_INTEGRATIONS = ['CFTC', 'NFA', 'Clearing Portal']

const firmPrefix = (name: string) => String(name).split(/[^A-Za-z0-9]+/).filter(Boolean).map(word => word[0].toUpperCase()).join('').slice(0, 4)
const sampleToken = (n: number) => {
  const part = (v: number) => ((v * 40503 + 6571) % 65536).toString(16).padStart(4, '0')
  return `${part(n + 1)}-${part(n + 2)}`
}

function addAssociations(f: Firm, index: number, all: Firm[]) {
  (ASSOC[f.type] || []).forEach((box, boxIndex) => {
    const options = all.filter(x => !x.deleted && x.type === box.type && x.id !== f.id).map(x => x.id)
    const list = f.assoc[box.key] || (f.assoc[box.key] = [])
    const target = Math.min(options.length, 2 + (index + boxIndex) % 2)
    for (let step = 0; step < options.length && list.length < target; step += 1) {
      const id = options[(index + boxIndex + step) % options.length]
      if (!list.includes(id)) list.push(id)
    }
  })
}

function clearingFirmFor(f: Firm, all: Firm[]) {
  if (f.type === 'clearingMember') return f.name
  const linked = all.find(x => x.id === (f.assoc.clearingMembers || [])[0])
  return linked ? linked.name : 'Connamara Clearing'
}

function addUsers(f: Firm, index: number, nextPerson: () => string) {
  const roles = ROLES_BY_TYPE[f.type] || []
  const target = 4 + index % 4
  for (let i = f.users.length; i < target; i += 1) {
    const displayName = nextPerson()
    const id = displayName.toLowerCase().replace(/\s+/g, '.')
    if (!f.users.some((u: any) => u.id === id)) f.users.push(user(id, displayName, roles[i % roles.length], i % 5 === 4 ? 'Suspended' : 'Active'))
  }
}

function addAccounts(f: Firm, index: number, all: Firm[]) {
  const types = SAMPLE_ACCOUNT_TYPES[f.type]
  const target = 4 + index % 3
  const prefix = firmPrefix(f.name)
  SAMPLE_ACCOUNT_NAMES.forEach((suffix, i) => {
    const id = `${prefix}-${suffix}`
    if (f.accounts.length >= target || f.accounts.some((a: any) => a.id === id)) return
    const sized = i % 2 === 0
    const collateral = i % 3 === 1 && f.accounts.length > 0
    f.accounts.push(account(id, types[i % types.length], clearingFirmFor(f, all), {
      clearingHouse: f.type === 'clearingHouse' ? f.name : 'Connamara Clearing House',
      state: i % 5 === 3 ? 'Suspended' : i % 7 === 5 ? 'Liquidate Only' : 'Active',
      riskProfile: SAMPLE_RISK_PROFILES[i % SAMPLE_RISK_PROFILES.length],
      priorityWeight: i + 1,
      collateralReturnEnabled: collateral,
      collateralAccount: collateral ? f.accounts[0].id : '',
      orderSizeLow: sized ? 1 : '',
      orderSizeLowSet: sized,
      orderSizeHigh: sized ? (i + 1) * 100 : '',
      orderSizeHighSet: sized,
    }))
  })
}

function addPositions(f: Firm, index: number) {
  f.accounts.forEach((acct: any, i: number) => {
    if (f.positions.some((p: any) => p.account === acct.id)) return
    for (let row = 0; row <= i % 2; row += 1) {
      const n = index * 7 + i * 13 + row * 5
      const bod = n % 41 - 20
      const bought = n % 17
      const sold = n * 3 % 13
      const open = bod + bought - sold
      f.positions.push({ account: acct.id, symbol: SAMPLE_SYMBOLS[(index + i + row) % SAMPLE_SYMBOLS.length], subType: open < 0 ? 'Short' : 'Long', bod, open, bought, sold, unsettled: bought - sold })
    }
  })
}

function addLimits(f: Firm, index: number) {
  const target = 4 + index % 2
  for (let i = 0; f.limits.length < target && i < SAMPLE_PRODUCTS.length; i += 1) {
    const slot = (index + i) % SAMPLE_PRODUCTS.length
    const usesProduct = i % 2 === 0
    const product = usesProduct ? SAMPLE_PRODUCTS[slot] : ''
    const symbol = usesProduct ? '' : SAMPLE_SYMBOLS[slot]
    if (f.limits.some((l: any) => (product && l.product === product) || (symbol && l.symbol === symbol))) continue
    const size = (slot + 1) * 250
    f.limits.push({ product, symbol, aggregated: usesProduct && i % 4 === 0, shortPositionLimit: size, longPositionLimit: size + 100 })
  }
}

function addServices(f: Firm, index: number) {
  const roles = ROLES_BY_TYPE[f.type]
  SAMPLE_SERVICES.forEach(([id, description], i) => {
    if (f.services.length < 3 && !f.services.some((s: any) => s.id === id)) f.services.push(service(id, description, roles[(index + i) % roles.length]))
  })
  f.services.forEach((svc: any, i: number) => {
    SAMPLE_KEYS.forEach((suffix, k) => {
      const id = `${svc.id}-${suffix}`
      if (svc.keys.length < 2 && !svc.keys.some((x: any) => x.id === id)) {
        svc.keys.push({ id, description: `${suffix[0].toUpperCase()}${suffix.slice(1)} key`, role: svc.role, jti: sampleToken(index * 100 + i * 10 + k) })
      }
    })
  })
}

function addProfileLists(f: Firm, index: number, nextPerson: () => string) {
  while (f.personnel.length < 2) {
    const name = nextPerson()
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`
    f.personnel.push({ name, email, phoneNumber: `+1 312 555 0${100 + (index * 11 + f.personnel.length * 7) % 900}`, role: SAMPLE_ROLES[(index + f.personnel.length) % SAMPLE_ROLES.length] })
  }
  if (!f.aliases.length) f.aliases.push({ option: SAMPLE_INTEGRATIONS[index % SAMPLE_INTEGRATIONS.length], alias: `${firmPrefix(f.name)}-${1000 + index}` })
  if (!f.altNames.length && index % 2 === 0) f.altNames.push({ name: `${f.name} Group` })
}

function enrichFirms(all: Firm[]) {
  let person = 0
  const nextPerson = () => SAMPLE_PEOPLE[person++ % SAMPLE_PEOPLE.length]
  const hasTab = (f: Firm, path: string) => TABS.some(tab => tab.path === path && tab.when(f))
  all.forEach((f, index) => addAssociations(f, index, all))
  all.forEach((f, index) => {
    if (hasTab(f, 'users')) addUsers(f, index, nextPerson)
    if (hasTab(f, 'accounts')) {
      addAccounts(f, index, all)
      addPositions(f, index)
    }
    if (hasTab(f, 'position-limits')) addLimits(f, index)
    if (hasTab(f, 'services')) addServices(f, index)
    addProfileLists(f, index, nextPerson)
  })
  return all
}

export const seedFirms = () => enrichFirms(baseFirms())
