'use strict'

const Datastore = require('@google-cloud/datastore')
const datastore = Datastore()
const express = require('express')
const app = express();

app.head('/:uid', function(req, res) {
    res.sendStatus(200)
})

app.get('/:uid', function(req, res) {
    const voteKey = datastore.key(['vote', req.params.uid])
    const ipKey = datastore.key(['vote', req.params.uid, 'ip', req.ip])

    Promise.all([
        datastore.get(voteKey),
        datastore.get(ipKey)
    ])
        .then(result => {
            let vote = result[0][0]
            let ip   = result[1][0]

            if (!vote) {
                res.json({ votes: 0, voted: false })
            } else {
                res.json({ votes: vote.count, voted: !!ip })
            }

        })
        .catch(err => {
            console.log('Error:', err)
            res.sendStatus(500)
        })
})

app.post('/:uid', function(req, res) {
    const transaction = datastore.transaction()

    const voteKey = datastore.key(['vote', req.params.uid])
    const ipKey = datastore.key(['vote', req.params.uid, 'ip', req.ip])

    return transaction.run()
        .then(() => Promise.all([
            transaction.get(voteKey),
            transaction.get(ipKey)
        ]))
        .then(result => {
            let vote = result[0][0]
            let ip   = result[1][0]

            if (!vote) {
                vote = { count: 0 }
            }
            if (ip !== undefined) {
                return vote.count
            }
            vote.count += 1

            transaction.save({ key: voteKey, data: vote })
            transaction.save({ key: ipKey, data: { votedAt: new Date() } })

            return transaction.commit()
                .then(() => vote.count)
        })
        .then(count => res.json({ votes: count }))
        .catch(err => {
            transaction.rollback()
            console.log('Error:', err)
            res.sendStatus(500)
        })
})

app.delete('/:uid', function(req, res) {
    const transaction = datastore.transaction()

    const voteKey = datastore.key(['vote', req.params.uid])
    const ipKey = datastore.key(['vote', req.params.uid, 'ip', req.ip])

    return transaction.run()
        .then(() => Promise.all([
            transaction.get(voteKey),
            transaction.get(ipKey)
        ]))
        .then(result => {
            let vote = result[0][0]
            let ip   = result[1][0]

            if (!vote) {
                return 0
            }
            if (!ip) {
                return vote.count
            }

            if (vote.count > 0) {
                vote.count -= 1
            }

            transaction.save({ key: voteKey, data: vote })
            transaction.delete(ipKey)

            return transaction.commit()
                .then(() => vote.count)
        })
        .then(count => res.json({ votes: count }))
        .catch(err => {
            transaction.rollback()
            console.log('Error:', err)
            res.sendStatus(500)
        })
})

exports.index = app.handle
